import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import dotenv from 'dotenv';
import { db, Poll, PollOption, QuizQuestion } from './server/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rate Limiter (sliding window per IP)
const ipRequestTimestamps = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const list = ipRequestTimestamps.get(key) || [];
  const valid = list.filter((t) => t > now - windowMs);
  if (valid.length >= maxRequests) {
    ipRequestTimestamps.set(key, valid);
    return false;
  }
  valid.push(now);
  ipRequestTimestamps.set(key, valid);
  return true;
}

// Periodic cleanup of rate limiter entries
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, list] of ipRequestTimestamps.entries()) {
    const valid = list.filter((t) => t > cutoff);
    if (valid.length === 0) {
      ipRequestTimestamps.delete(key);
    } else {
      ipRequestTimestamps.set(key, valid);
    }
  }
}, 300000);

// Connected SSE clients for live updates
const sseClients: Map<string, Set<Response>> = new Map();

async function broadcastPollUpdate(pollId: string) {
  const poll = await db.getPollByIdOrCode(pollId);

  const targetKeys = new Set<string>([pollId]);
  if (poll) {
    targetKeys.add(poll.id);
    targetKeys.add(poll.join_code);
    targetKeys.add(poll.join_code.toUpperCase());
    targetKeys.add(poll.join_code.toLowerCase());
  }

  const seenResponses = new Set<Response>();

  for (const key of targetKeys) {
    const clients = sseClients.get(key);
    if (clients && clients.size > 0) {
      const payload = JSON.stringify({
        type: 'UPDATE',
        pollId: poll ? poll.id : pollId,
        timestamp: Date.now(),
      });
      for (const res of clients) {
        if (seenResponses.has(res)) continue;
        seenResponses.add(res);
        try {
          res.write(`data: ${payload}\n\n`);
        } catch {
          clients.delete(res);
        }
      }
    }
  }
}

// Sanitizes poll object before sending to client/students (secret answer never revealed)
function sanitizePollForClient(poll: Poll): Poll {
  const copy: Poll = { ...poll };
  delete copy.correct_option_id;

  if (copy.questions && Array.isArray(copy.questions)) {
    copy.questions = copy.questions.map((q) => {
      const qCopy = { ...q };
      delete qCopy.correct_option_id;
      return qCopy;
    });

    const currentIdx = copy.current_question_index ?? 0;
    if (copy.questions[currentIdx]) {
      const activeQ = copy.questions[currentIdx];
      copy.question = activeQ.question_text;
      copy.options = activeQ.options;
      copy.time_limit_seconds = activeQ.time_limit_seconds;
    }
  }

  return copy;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CORS support for mobile devices
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, X-Forwarded-For');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // 1. Get all polls (Sanitizes quiz polls so correct_option_id is never visible)
  app.get('/api/polls', async (_req: Request, res: Response) => {
    const polls = await db.getPolls();
    const sanitized = polls.map((p) => sanitizePollForClient(p));
    res.json(sanitized);
  });

  // 2. Get single poll by ID or join code (case-insensitive, answer kept secret)
  app.get('/api/polls/:idOrCode', async (req: Request, res: Response) => {
    const query = req.params.idOrCode.trim();
    const poll = await db.getPollByIdOrCode(query);

    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    // Auto-transition from countdown to active if 3-second timer has elapsed
    if (poll.quiz_state === 'countdown' && poll.countdown_end_at) {
      if (Date.now() >= new Date(poll.countdown_end_at).getTime()) {
        poll.quiz_state = 'active';
        poll.question_started_at = new Date().toISOString();
        await db.updatePoll(poll.id, {
          quiz_state: 'active',
          question_started_at: poll.question_started_at,
        });
      }
    }

    // Generate lightweight ETag based on poll status, state, current question index, and total questions
    const etag = `W/"${poll.id}-${poll.status}-${poll.quiz_state || 'none'}-${poll.current_question_index ?? 0}-${poll.questions?.length ?? 1}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=2, stale-while-revalidate=5');

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.json(sanitizePollForClient(poll));
  });

  // 3. Create poll (Supports single poll & multi-question quiz mode)
  app.post('/api/polls', async (req: Request, res: Response) => {
    const { title, question, type, options, correctOptionIndex, timeLimitSeconds, questions } = req.body;

    if (!title || !type) {
      res.status(400).json({ error: 'Missing required poll fields' });
      return;
    }

    const pollId = 'poll_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let joinCode = '';
    for (let i = 0; i < 6; i++) {
      joinCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    let formattedQuestions: QuizQuestion[] = [];
    let initialQuestion = String(question || '').trim();
    let initialOptions: PollOption[] = [];
    let initialCorrectId: string | null = null;
    let initialTimeLimit = typeof timeLimitSeconds === 'number' ? timeLimitSeconds : 30;

    if (type === 'quiz') {
      if (Array.isArray(questions) && questions.length > 0) {
        formattedQuestions = questions.map((qItem: any, qIdx: number) => {
          const qId = `${pollId}-q-${qIdx + 1}`;
          const qOpts: PollOption[] = (qItem.options || []).map((optText: string, optIdx: number) => ({
            id: `${qId}-opt-${optIdx + 1}`,
            poll_id: pollId,
            option_text: String(optText).trim(),
            option_order: optIdx + 1,
          }));

          const cIdx = typeof qItem.correctOptionIndex === 'number' ? qItem.correctOptionIndex : 0;
          const cId = qOpts[cIdx] ? qOpts[cIdx].id : (qOpts[0]?.id || null);

          return {
            id: qId,
            poll_id: pollId,
            question_text: String(qItem.question || `Question ${qIdx + 1}`).trim(),
            options: qOpts,
            correct_option_id: cId,
            time_limit_seconds: typeof qItem.timeLimitSeconds === 'number' ? qItem.timeLimitSeconds : 30,
            question_order: qIdx + 1,
          };
        });

        initialQuestion = formattedQuestions[0].question_text;
        initialOptions = formattedQuestions[0].options;
        initialCorrectId = formattedQuestions[0].correct_option_id || null;
        initialTimeLimit = formattedQuestions[0].time_limit_seconds;
      } else {
        const singleQId = `${pollId}-q-1`;
        const qOpts: PollOption[] = (Array.isArray(options) ? options : []).map((optText: string, index: number) => ({
          id: `${singleQId}-opt-${index + 1}`,
          poll_id: pollId,
          option_text: String(optText).trim(),
          option_order: index + 1,
        }));
        const cIdx = typeof correctOptionIndex === 'number' ? correctOptionIndex : 0;
        initialCorrectId = qOpts[cIdx] ? qOpts[cIdx].id : null;
        initialOptions = qOpts;

        formattedQuestions = [
          {
            id: singleQId,
            poll_id: pollId,
            question_text: initialQuestion,
            options: qOpts,
            correct_option_id: initialCorrectId,
            time_limit_seconds: initialTimeLimit,
            question_order: 1,
          },
        ];
      }
    } else if (type === 'yes_no') {
      initialOptions = [
        { id: `${pollId}-opt-1`, poll_id: pollId, option_text: 'Yes', option_order: 1 },
        { id: `${pollId}-opt-2`, poll_id: pollId, option_text: 'No', option_order: 2 },
      ];
    } else if (type === 'multiple_choice' && Array.isArray(options)) {
      initialOptions = options.map((optText: string, index: number) => ({
        id: `${pollId}-opt-${index + 1}`,
        poll_id: pollId,
        option_text: String(optText).trim(),
        option_order: index + 1,
      }));
    }

    const newPoll: Poll = {
      id: pollId,
      title: String(title).trim(),
      question: initialQuestion,
      type,
      status: 'draft',
      join_code: joinCode,
      created_at: new Date().toISOString(),
      options: initialOptions,
      correct_option_id: initialCorrectId,
      time_limit_seconds: initialTimeLimit,
      questions: formattedQuestions.length > 0 ? formattedQuestions : undefined,
      current_question_index: 0,
      quiz_state: type === 'quiz' ? 'lobby' : undefined,
    };

    await db.createPoll(newPoll);
    broadcastPollUpdate(pollId);
    res.status(201).json(sanitizePollForClient(newPoll));
  });

  // Host Quiz Control: Start Quiz
  app.post('/api/polls/:id/quiz/start', async (req: Request, res: Response) => {
    const { id } = req.params;
    const poll = await db.getPollByIdOrCode(id);
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    const updates: Partial<Poll> = {
      status: 'active',
      current_question_index: 0,
      quiz_started_at: new Date().toISOString(),
      quiz_state: 'countdown',
      countdown_end_at: new Date(Date.now() + 3000).toISOString(),
      question_started_at: null,
    };

    if (poll.questions && poll.questions[0]) {
      const firstQ = poll.questions[0];
      updates.question = firstQ.question_text;
      updates.options = firstQ.options;
      updates.correct_option_id = firstQ.correct_option_id;
      updates.time_limit_seconds = firstQ.time_limit_seconds;
    }

    const updated = await db.updatePoll(poll.id, updates);
    broadcastPollUpdate(id);
    res.json(sanitizePollForClient(updated || poll));
  });

  // Host Quiz Control: Advance to Next Question
  app.post('/api/polls/:id/quiz/next', async (req: Request, res: Response) => {
    const { id } = req.params;
    const poll = await db.getPollByIdOrCode(id);
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    const currentIdx = poll.current_question_index ?? 0;
    const nextIdx = currentIdx + 1;

    let updates: Partial<Poll> = {};

    if (poll.questions && nextIdx < poll.questions.length) {
      const nextQ = poll.questions[nextIdx];
      updates = {
        current_question_index: nextIdx,
        question: nextQ.question_text,
        options: nextQ.options,
        correct_option_id: nextQ.correct_option_id,
        time_limit_seconds: nextQ.time_limit_seconds,
        quiz_state: 'countdown',
        countdown_end_at: new Date(Date.now() + 3000).toISOString(),
        question_started_at: null,
      };
    } else {
      updates = {
        quiz_state: 'completed',
        status: 'closed',
      };
    }

    const updated = await db.updatePoll(poll.id, updates);
    broadcastPollUpdate(id);
    res.json(sanitizePollForClient(updated || poll));
  });

  // Host Quiz Control: End Quiz
  app.post('/api/polls/:id/quiz/end', async (req: Request, res: Response) => {
    const { id } = req.params;
    const poll = await db.getPollByIdOrCode(id);
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    const updated = await db.updatePoll(poll.id, {
      quiz_state: 'completed',
      status: 'closed',
    });
    broadcastPollUpdate(id);
    res.json(sanitizePollForClient(updated || poll));
  });

  // Host Quiz Control: End Current Question
  app.post('/api/polls/:id/quiz/end-question', async (req: Request, res: Response) => {
    const { id } = req.params;
    const poll = await db.getPollByIdOrCode(id);
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    const updated = await db.updatePoll(poll.id, { quiz_state: 'question_ended' });
    broadcastPollUpdate(id);
    res.json(sanitizePollForClient(updated || poll));
  });

  // Transition from countdown to active
  app.post('/api/polls/:id/quiz/activate-question', async (req: Request, res: Response) => {
    const { id } = req.params;
    const poll = await db.getPollByIdOrCode(id);
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    const updated = await db.updatePoll(poll.id, {
      quiz_state: 'active',
      question_started_at: new Date().toISOString(),
    });
    broadcastPollUpdate(id);
    res.json(sanitizePollForClient(updated || poll));
  });

  // 4. Update poll status
  app.patch('/api/polls/:id/status', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    const poll = await db.getPollByIdOrCode(id);
    if (!poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    if (['draft', 'active', 'closed'].includes(status)) {
      const updates: Partial<Poll> = { status };
      if (status === 'active' && poll.type === 'quiz') {
        if (!poll.quiz_started_at) updates.quiz_started_at = new Date().toISOString();
        if (poll.quiz_state === 'lobby') updates.quiz_state = 'active';
      }
      const updated = await db.updatePoll(poll.id, updates);
      broadcastPollUpdate(id);
      res.json(sanitizePollForClient(updated || poll));
    } else {
      res.status(400).json({ error: 'Invalid status' });
    }
  });

  // 5. Delete poll
  app.delete('/api/polls/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    await db.deletePoll(id);
    broadcastPollUpdate(id);
    res.json({ success: true });
  });

  // 6. Submit student vote / quiz answer (Idempotent, Atomic, Server-Validated)
  app.post('/api/polls/:id/vote', async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      optionId,
      ratingValue,
      participantId,
      participantName,
      responseTimeMs,
      questionIndex,
      clientRequestId,
    } = req.body;

    // Rate Limiting per client IP (60 requests per 30s)
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';
    if (!checkRateLimit(`vote:${clientIp}`, 60, 30000)) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
      return;
    }

    const reqId = String(clientRequestId || req.body.requestId || req.headers['x-request-id'] || '').trim();

    try {
      const result = await db.submitVote({
        pollId: id,
        optionId,
        ratingValue,
        participantId,
        participantName,
        responseTimeMs,
        questionIndex,
        clientRequestId: reqId || null,
      });

      broadcastPollUpdate(id);

      // Status 201 for vote submission or successful idempotent replay
      res.status(201).json(result);
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('already submitted')) {
        res.status(409).json({ error: 'You have already submitted your response for this question.' });
        return;
      }
      if (err.status) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      console.error('Vote submission error:', err);
      res.status(500).json({ error: 'Internal server error while recording vote.' });
    }
  });

  // 7. Get live results (Database aggregation)
  app.get('/api/polls/:id/results', async (req: Request, res: Response) => {
    const { id } = req.params;
    const results = await db.getPollResults(id);

    if (!results || !results.poll) {
      res.status(404).json({ error: 'Poll not found' });
      return;
    }

    res.json({
      ...results,
      poll: sanitizePollForClient(results.poll),
    });
  });

  // 8. Server-Sent Events (SSE) stream
  app.get('/api/polls/:id/events', async (req: Request, res: Response) => {
    const { id } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const poll = await db.getPollByIdOrCode(id);
    const registerKeys = new Set<string>([id]);
    if (poll) {
      registerKeys.add(poll.id);
      registerKeys.add(poll.join_code);
      registerKeys.add(poll.join_code.toUpperCase());
    }

    for (const key of registerKeys) {
      if (!sseClients.has(key)) {
        sseClients.set(key, new Set());
      }
      sseClients.get(key)!.add(res);
    }

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', pollId: poll ? poll.id : id })}\n\n`);

    req.on('close', () => {
      for (const key of registerKeys) {
        const clients = sseClients.get(key);
        if (clients) {
          clients.delete(res);
          if (clients.size === 0) {
            sseClients.delete(key);
          }
        }
      }
    });
  });

  // Public application configuration endpoint (runtime APP_URL / VITE_APP_URL)
  app.get('/api/config', (_req: Request, res: Response) => {
    const rawUrl = (process.env.VITE_APP_URL || process.env.APP_URL || '').trim();
    const appUrl = rawUrl && rawUrl !== 'MY_APP_URL' ? rawUrl.replace(/\/+$/, '') : null;
    res.json({
      appUrl,
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Check if participant voted (Queries database, does not search in-memory array)
  app.get('/api/polls/:id/voted/:participantId', async (req: Request, res: Response) => {
    const { id, participantId } = req.params;
    const targetIdx = req.query.questionIndex !== undefined
      ? Number(req.query.questionIndex)
      : undefined;

    const status = await db.getParticipantVoteStatus(id, participantId, targetIdx);
    res.json(status);
  });

  // Catch-all 404 handler for unhandled API requests
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Mount Vite middleware in development or serve static assets in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Development SPA fallback: handles /poll/:pollId and other routes on direct access or refresh
    app.get('*', async (req: Request, res: Response, next) => {
      try {
        const url = req.originalUrl;
        const template = await fs.promises.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        next(e);
      }
    });
  } else {
    // Production SPA serving: serves dist/ and falls back to dist/index.html for any route like /poll/:pollId
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Campus Vote server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
