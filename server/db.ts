import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.resolve(DATA_DIR, 'campus_vote_db.json');

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  option_order: number;
}

export interface QuizQuestion {
  id: string;
  poll_id: string;
  question_text: string;
  options: PollOption[];
  correct_option_id?: string | null;
  time_limit_seconds: number;
  question_order: number;
}

export interface Poll {
  id: string;
  title: string;
  question: string;
  type: 'yes_no' | 'multiple_choice' | 'rating' | 'quiz';
  status: 'draft' | 'active' | 'closed';
  join_code: string;
  created_at: string;
  options?: PollOption[];
  correct_option_id?: string | null;
  quiz_started_at?: string | null;
  time_limit_seconds?: number;
  questions?: QuizQuestion[];
  current_question_index?: number;
  quiz_state?: 'lobby' | 'countdown' | 'active' | 'question_ended' | 'completed';
  countdown_end_at?: string | null;
  question_started_at?: string | null;
}

export interface PollResponse {
  id: string;
  poll_id: string;
  question_id?: string | null;
  question_index?: number | null;
  option_id?: string | null;
  rating_value?: number | null;
  participant_id: string;
  participant_name?: string | null;
  response_time_ms?: number | null;
  points?: number | null;
  is_correct?: boolean | null;
  client_request_id?: string | null;
  created_at: string;
}

export interface IdempotentRecord {
  status: number;
  body: any;
  timestamp: number;
}

// Initial seed data (clearly separated from production storage)
const SEED_DATA: { polls: Poll[]; options: PollOption[]; responses: PollResponse[] } = {
  polls: [
    {
      id: 'demo-quiz-lightning',
      title: 'CS Speed Challenge: 3-Round Blitz',
      question: 'What is the average time complexity of lookups in a balanced Binary Search Tree?',
      type: 'quiz',
      status: 'active',
      join_code: 'SPEED9',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      correct_option_id: 'q1-opt-2',
      quiz_started_at: new Date(Date.now() - 3600000).toISOString(),
      time_limit_seconds: 30,
      current_question_index: 0,
      quiz_state: 'active',
      questions: [
        {
          id: 'q1',
          poll_id: 'demo-quiz-lightning',
          question_text: 'What is the average time complexity of lookups in a balanced Binary Search Tree?',
          options: [
            { id: 'q1-opt-1', poll_id: 'demo-quiz-lightning', option_text: 'O(1)', option_order: 1 },
            { id: 'q1-opt-2', poll_id: 'demo-quiz-lightning', option_text: 'O(log n)', option_order: 2 },
            { id: 'q1-opt-3', poll_id: 'demo-quiz-lightning', option_text: 'O(n)', option_order: 3 },
            { id: 'q1-opt-4', poll_id: 'demo-quiz-lightning', option_text: 'O(n log n)', option_order: 4 },
          ],
          correct_option_id: 'q1-opt-2',
          time_limit_seconds: 30,
          question_order: 1,
        },
        {
          id: 'q2',
          poll_id: 'demo-quiz-lightning',
          question_text: 'Which HTTP status code signifies that a resource was permanently moved?',
          options: [
            { id: 'q2-opt-1', poll_id: 'demo-quiz-lightning', option_text: '200 OK', option_order: 1 },
            { id: 'q2-opt-2', poll_id: 'demo-quiz-lightning', option_text: '301 Moved Permanently', option_order: 2 },
            { id: 'q2-opt-3', poll_id: 'demo-quiz-lightning', option_text: '404 Not Found', option_order: 3 },
            { id: 'q2-opt-4', poll_id: 'demo-quiz-lightning', option_text: '502 Bad Gateway', option_order: 4 },
          ],
          correct_option_id: 'q2-opt-2',
          time_limit_seconds: 20,
          question_order: 2,
        },
        {
          id: 'q3',
          poll_id: 'demo-quiz-lightning',
          question_text: 'Which sorting algorithm has a guaranteed worst-case time complexity of O(n log n)?',
          options: [
            { id: 'q3-opt-1', poll_id: 'demo-quiz-lightning', option_text: 'Quick Sort', option_order: 1 },
            { id: 'q3-opt-2', poll_id: 'demo-quiz-lightning', option_text: 'Merge Sort', option_order: 2 },
            { id: 'q3-opt-3', poll_id: 'demo-quiz-lightning', option_text: 'Bubble Sort', option_order: 3 },
            { id: 'q3-opt-4', poll_id: 'demo-quiz-lightning', option_text: 'Insertion Sort', option_order: 4 },
          ],
          correct_option_id: 'q3-opt-2',
          time_limit_seconds: 25,
          question_order: 3,
        },
      ],
    },
    {
      id: 'demo-tech-fest',
      title: 'College Tech Fest 2026',
      question: 'Which keynote track are you most excited for today?',
      type: 'multiple_choice',
      status: 'active',
      join_code: 'TECH26',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'demo-algorithms-check',
      title: 'CS301: Graph Algorithms Lecture',
      question: 'Did today’s visual breakdown of Dijkstra’s shortest path make sense?',
      type: 'yes_no',
      status: 'active',
      join_code: 'ALGO99',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
  ],
  options: [
    { id: 'q1-opt-1', poll_id: 'demo-quiz-lightning', option_text: 'O(1)', option_order: 1 },
    { id: 'q1-opt-2', poll_id: 'demo-quiz-lightning', option_text: 'O(log n)', option_order: 2 },
    { id: 'q1-opt-3', poll_id: 'demo-quiz-lightning', option_text: 'O(n)', option_order: 3 },
    { id: 'q1-opt-4', poll_id: 'demo-quiz-lightning', option_text: 'O(n log n)', option_order: 4 },
    { id: 'opt-1', poll_id: 'demo-tech-fest', option_text: 'Autonomous Robotics & Drones', option_order: 1 },
    { id: 'opt-2', poll_id: 'demo-tech-fest', option_text: 'Web3 & Decentralized Cloud', option_order: 2 },
    { id: 'opt-3', poll_id: 'demo-tech-fest', option_text: 'Full-Stack System Architecture', option_order: 3 },
    { id: 'opt-4', poll_id: 'demo-tech-fest', option_text: 'Cybersecurity & Ethical Hacking', option_order: 4 },
    { id: 'opt-yes', poll_id: 'demo-algorithms-check', option_text: 'Yes', option_order: 1 },
    { id: 'opt-no', poll_id: 'demo-algorithms-check', option_text: 'No', option_order: 2 },
  ],
  responses: [
    {
      id: 'qr1',
      poll_id: 'demo-quiz-lightning',
      question_id: 'q1',
      question_index: 0,
      option_id: 'q1-opt-2',
      participant_id: 'p_alex',
      participant_name: 'Alex Chen',
      response_time_ms: 2150,
      points: 928,
      is_correct: true,
      created_at: new Date(Date.now() - 50000).toISOString(),
    },
    {
      id: 'qr2',
      poll_id: 'demo-quiz-lightning',
      question_id: 'q1',
      question_index: 0,
      option_id: 'q1-opt-2',
      participant_id: 'p_priya',
      participant_name: 'Priya Sharma',
      response_time_ms: 3420,
      points: 886,
      is_correct: true,
      created_at: new Date(Date.now() - 48000).toISOString(),
    },
    { id: 'r1', poll_id: 'demo-tech-fest', option_id: 'opt-1', participant_id: 'p_init_1', created_at: new Date().toISOString() },
    { id: 'r2', poll_id: 'demo-tech-fest', option_id: 'opt-1', participant_id: 'p_init_2', created_at: new Date().toISOString() },
    { id: 'r3', poll_id: 'demo-tech-fest', option_id: 'opt-2', participant_id: 'p_init_3', created_at: new Date().toISOString() },
    { id: 'r20', poll_id: 'demo-algorithms-check', option_id: 'opt-yes', participant_id: 'p_20', created_at: new Date().toISOString() },
    { id: 'r21', poll_id: 'demo-algorithms-check', option_id: 'opt-yes', participant_id: 'p_21', created_at: new Date().toISOString() },
  ],
};

/**
 * CampusVote Database Layer
 * Primary source of truth: Supabase PostgreSQL
 * When Supabase URL is configured, all database queries run directly on Supabase PostgreSQL.
 * When running offline or in environments without remote Supabase credentials,
 * it runs against the persistent PostgreSQL-emulated schema on disk, strictly enforcing
 * the UNIQUE(poll_id, participant_id, question_index) constraint (error 23505) and persistence across restarts.
 */
export class CampusVoteDatabase {
  private supabase: SupabaseClient | null = null;
  public isSupabaseActive = false;

  // Persistent Relational Tables (used when remote Supabase credentials are not supplied)
  private tablePolls: Poll[] = [];
  private tablePollOptions: PollOption[] = [];
  private tableResponses: PollResponse[] = [];
  private tableIdempotency: Map<string, IdempotentRecord> = new Map();

  constructor() {
    this.initSupabaseClient();
    this.initPersistentStorage();
  }

  /**
   * Initializes official Supabase client using server environment variables.
   * Service-role key is kept exclusively on the server and never exposed to the frontend.
   */
  private initSupabaseClient() {
    const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const key = (
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ''
    ).trim();

    if (
      url &&
      key &&
      url.startsWith('https://') &&
      !url.includes('your-project.supabase.co') &&
      key !== 'your-anon-key'
    ) {
      try {
        this.supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        this.isSupabaseActive = true;
        console.log('[CampusVote DB] Successfully initialized official Supabase client:', url);
      } catch (err) {
        console.warn('[CampusVote DB] Supabase initialization warning:', err);
      }
    } else {
      console.log('[CampusVote DB] Supabase remote URL not supplied. Operating in persistent PostgreSQL schema mode.');
    }
  }

  /**
   * Loads persistent database from disk file so data persists across server restarts.
   */
  private initPersistentStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.tablePolls = Array.isArray(parsed.polls) ? parsed.polls : [];
        this.tablePollOptions = Array.isArray(parsed.poll_options) ? parsed.poll_options : [];
        this.tableResponses = Array.isArray(parsed.responses) ? parsed.responses : [];
        if (Array.isArray(parsed.idempotency)) {
          for (const item of parsed.idempotency) {
            if (item && item.key && item.record) {
              this.tableIdempotency.set(item.key, item.record);
            }
          }
        }
        console.log(
          `[CampusVote DB] Restored persistent database from disk: ${this.tablePolls.length} polls, ${this.tableResponses.length} responses.`
        );
      } else {
        // Initialize fresh database with seed data
        this.tablePolls = [...SEED_DATA.polls];
        this.tablePollOptions = [...SEED_DATA.options];
        this.tableResponses = [...SEED_DATA.responses];
        this.flushToDisk();
        console.log(
          `[CampusVote DB] Initialized fresh database with seed polls: ${this.tablePolls.length} polls.`
        );
      }
    } catch (err) {
      console.error('[CampusVote DB] Error reading persistent storage from disk:', err);
      this.tablePolls = [...SEED_DATA.polls];
      this.tablePollOptions = [...SEED_DATA.options];
      this.tableResponses = [...SEED_DATA.responses];
    }
  }

  /**
   * Flushes tables atomically to disk database file.
   */
  private flushToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = {
        polls: this.tablePolls,
        poll_options: this.tablePollOptions,
        responses: this.tableResponses,
        idempotency: Array.from(this.tableIdempotency.entries()).map(([key, record]) => ({
          key,
          record,
        })),
        updatedAt: new Date().toISOString(),
      };
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[CampusVote DB] Failed to flush data to disk:', err);
    }
  }

  // =========================================================
  // 1. POLL RETRIEVAL (GET /api/polls & GET /api/polls/:idOrCode)
  // =========================================================

  public async getPolls(): Promise<Poll[]> {
    if (this.isSupabaseActive && this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('polls')
          .select('*, options:poll_options(*)')
          .order('created_at', { ascending: false });
        if (!error && data) {
          return data.map((p) => this.attachOptionsToPoll(p, p.options));
        }
      } catch (err) {
        console.warn('[CampusVote DB] Supabase getPolls error:', err);
      }
    }

    return this.tablePolls.map((poll) => {
      const opts = this.tablePollOptions.filter((o) => o.poll_id === poll.id);
      return this.attachOptionsToPoll(poll, opts);
    });
  }

  public async getPollByIdOrCode(idOrCode: string): Promise<Poll | null> {
    const query = idOrCode.trim();
    const queryUpper = query.toUpperCase();

    if (this.isSupabaseActive && this.supabase) {
      try {
        let q = this.supabase.from('polls').select('*, options:poll_options(*)');
        if (query.includes('-') && query.length > 10) {
          q = q.eq('id', query);
        } else {
          q = q.or(`id.eq.${query},join_code.eq.${queryUpper}`);
        }
        const { data, error } = await q.maybeSingle();
        if (!error && data) {
          return this.attachOptionsToPoll(data, data.options);
        }
      } catch (err) {
        console.warn('[CampusVote DB] Supabase getPollByIdOrCode error:', err);
      }
    }

    // Persistent table lookup
    for (const poll of this.tablePolls) {
      if (poll.id === query || poll.join_code.toUpperCase() === queryUpper) {
        const opts = this.tablePollOptions.filter((o) => o.poll_id === poll.id);
        return this.attachOptionsToPoll(poll, opts);
      }
    }

    return null;
  }

  private attachOptionsToPoll(poll: Poll, rawOptions?: PollOption[]): Poll {
    const copy: Poll = { ...poll };
    const opts = (rawOptions || []).sort((a, b) => a.option_order - b.option_order);
    copy.options = opts;

    // Attach to quiz questions if present
    if (copy.questions && Array.isArray(copy.questions)) {
      copy.questions = copy.questions.map((q) => {
        const qCopy = { ...q };
        if (!qCopy.options || qCopy.options.length === 0) {
          qCopy.options = opts.filter((o) => o.id.startsWith(q.id) || o.poll_id === copy.id);
        }
        return qCopy;
      });
      const currentIdx = copy.current_question_index ?? 0;
      if (copy.questions[currentIdx]) {
        copy.question = copy.questions[currentIdx].question_text;
        copy.options = copy.questions[currentIdx].options;
        copy.time_limit_seconds = copy.questions[currentIdx].time_limit_seconds;
        copy.correct_option_id = copy.questions[currentIdx].correct_option_id;
      }
    }

    return copy;
  }

  // =========================================================
  // 2. POLL CREATION (POST /api/polls)
  // =========================================================

  public async createPoll(poll: Poll): Promise<Poll> {
    if (this.isSupabaseActive && this.supabase) {
      try {
        const pollRow = {
          id: poll.id,
          title: poll.title,
          question: poll.question,
          type: poll.type,
          status: poll.status,
          join_code: poll.join_code,
          current_question_index: poll.current_question_index ?? 0,
          quiz_state: poll.quiz_state ?? 'lobby',
          time_limit_seconds: poll.time_limit_seconds ?? 30,
          correct_option_id: poll.correct_option_id,
          questions: poll.questions ? JSON.stringify(poll.questions) : null,
          quiz_started_at: poll.quiz_started_at,
          countdown_end_at: poll.countdown_end_at,
          question_started_at: poll.question_started_at,
          created_at: poll.created_at,
        };

        const { error: pollError } = await this.supabase.from('polls').insert(pollRow);
        if (pollError) throw pollError;

        if (poll.options && poll.options.length > 0) {
          const optionRows = poll.options.map((o) => ({
            id: o.id,
            poll_id: poll.id,
            option_text: o.option_text,
            option_order: o.option_order,
          }));
          const { error: optError } = await this.supabase.from('poll_options').insert(optionRows);
          if (optError) {
            // Rollback partially-created poll
            await this.supabase.from('polls').delete().eq('id', poll.id);
            throw optError;
          }
        }
      } catch (err) {
        console.warn('[CampusVote DB] Supabase createPoll error, saving to persistent store:', err);
      }
    }

    // Insert into persistent database tables
    this.tablePolls.unshift(poll);
    if (poll.options && poll.options.length > 0) {
      this.tablePollOptions.push(...poll.options);
    }
    this.flushToDisk();
    return poll;
  }

  // =========================================================
  // 3. POLL STATUS UPDATE (PATCH /api/polls/:id/status)
  // =========================================================

  public async updatePoll(pollId: string, updates: Partial<Poll>): Promise<Poll | null> {
    const pollIndex = this.tablePolls.findIndex((p) => p.id === pollId);
    if (pollIndex === -1 && !this.isSupabaseActive) return null;

    const existing = pollIndex !== -1 ? this.tablePolls[pollIndex] : null;
    const updated = { ...existing, ...updates } as Poll;
    if (pollIndex !== -1) {
      this.tablePolls[pollIndex] = updated;
    }

    if (this.isSupabaseActive && this.supabase) {
      try {
        const updatePayload: any = {};
        if (updates.status !== undefined) updatePayload.status = updates.status;
        if (updates.quiz_state !== undefined) updatePayload.quiz_state = updates.quiz_state;
        if (updates.current_question_index !== undefined)
          updatePayload.current_question_index = updates.current_question_index;
        if (updates.quiz_started_at !== undefined) updatePayload.quiz_started_at = updates.quiz_started_at;
        if (updates.countdown_end_at !== undefined) updatePayload.countdown_end_at = updates.countdown_end_at;
        if (updates.question_started_at !== undefined)
          updatePayload.question_started_at = updates.question_started_at;
        if (updates.question !== undefined) updatePayload.question = updates.question;
        if (updates.correct_option_id !== undefined)
          updatePayload.correct_option_id = updates.correct_option_id;

        await this.supabase.from('polls').update(updatePayload).eq('id', pollId);
      } catch (err) {
        console.warn('[CampusVote DB] Supabase updatePoll error:', err);
      }
    }

    this.flushToDisk();
    return updated;
  }

  // =========================================================
  // 4. POLL DELETION (DELETE /api/polls/:id)
  // =========================================================

  public async deletePoll(pollId: string): Promise<boolean> {
    this.tablePolls = this.tablePolls.filter((p) => p.id !== pollId);
    this.tablePollOptions = this.tablePollOptions.filter((o) => o.poll_id !== pollId);
    this.tableResponses = this.tableResponses.filter((r) => r.poll_id !== pollId);

    if (this.isSupabaseActive && this.supabase) {
      try {
        // Cascade delete in PostgreSQL removes poll_options and responses
        await this.supabase.from('polls').delete().eq('id', pollId);
      } catch (err) {
        console.warn('[CampusVote DB] Supabase deletePoll error:', err);
      }
    }

    this.flushToDisk();
    return true;
  }

  // =========================================================
  // 5. ATOMIC VOTE SUBMISSION (POST /api/polls/:id/vote)
  // =========================================================

  public async submitVote(params: {
    pollId: string;
    optionId?: string | null;
    ratingValue?: number | null;
    participantId: string;
    participantName?: string | null;
    responseTimeMs?: number;
    questionIndex?: number;
    clientRequestId?: string | null;
  }): Promise<{
    success: boolean;
    response: PollResponse;
    responseId: string;
    points: number | null;
    totalScore: number;
    isCorrect: boolean | null;
    selectedOptionId: string | null;
    questionIndex: number;
    totalQuestions: number;
    isIdempotentRetry?: boolean;
  }> {
    const {
      pollId,
      optionId,
      ratingValue,
      participantId,
      participantName,
      responseTimeMs,
      questionIndex,
      clientRequestId,
    } = params;

    const reqId = clientRequestId ? String(clientRequestId).trim() : null;

    // A. IDEMPOTENCY CHECK:
    // If client provided a clientRequestId, check if this request has already been recorded
    if (reqId) {
      if (this.tableIdempotency.has(reqId)) {
        const cached = this.tableIdempotency.get(reqId)!;
        return {
          ...cached.body,
          isIdempotentRetry: true,
        };
      }

      if (this.isSupabaseActive && this.supabase) {
        try {
          const { data: existingResp } = await this.supabase
            .from('responses')
            .select('*')
            .eq('client_request_id', reqId)
            .maybeSingle();

          if (existingResp) {
            const cachedResult = {
              success: true,
              response: existingResp,
              responseId: existingResp.id,
              points: existingResp.points,
              totalScore: existingResp.points || 0,
              isCorrect: existingResp.is_correct,
              selectedOptionId: existingResp.option_id,
              questionIndex: existingResp.question_index ?? 0,
              totalQuestions: 1,
              isIdempotentRetry: true,
            };
            return cachedResult;
          }
        } catch {}
      }
    }

    // B. SERVER-SIDE VALIDATION
    // 1. Poll must exist
    const poll = await this.getPollByIdOrCode(pollId);
    if (!poll) {
      const err: any = new Error('Poll not found');
      err.status = 404;
      throw err;
    }

    // 2. Poll must be active
    if (poll.status === 'closed') {
      const err: any = new Error('Voting has ended.');
      err.status = 400;
      throw err;
    }
    if (poll.status !== 'active') {
      const err: any = new Error('Poll is not currently active.');
      err.status = 400;
      throw err;
    }

    // 3. Participant identifier must be valid
    const pid = String(participantId || '').trim();
    if (!pid || pid.length > 128) {
      const err: any = new Error('Missing or invalid participant identifier');
      err.status = 400;
      throw err;
    }

    // 4. Target question & options validation
    const targetQIndex =
      typeof questionIndex === 'number' ? questionIndex : poll.current_question_index ?? 0;
    const activeQuestion =
      poll.questions && poll.questions[targetQIndex] ? poll.questions[targetQIndex] : null;
    const questionId = activeQuestion ? activeQuestion.id : poll.id;
    const allowedOptions = activeQuestion ? activeQuestion.options : poll.options || [];

    // 5. Option / Rating validation
    if (poll.type === 'rating') {
      const numRating = Number(ratingValue);
      if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        const err: any = new Error('Invalid rating. Please select between 1 and 5 stars.');
        err.status = 400;
        throw err;
      }
    } else {
      if (!optionId || typeof optionId !== 'string') {
        const err: any = new Error('Please select an answer option.');
        err.status = 400;
        throw err;
      }
      const optionExists = allowedOptions.some((o) => o.id === optionId);
      if (!optionExists) {
        const err: any = new Error('Invalid answer option selected.');
        err.status = 400;
        throw err;
      }
    }

    // C. SCORING (FOR QUIZ MODE)
    let isCorrect: boolean | null = null;
    let points: number | null = null;
    const timeMs = typeof responseTimeMs === 'number' ? Math.max(300, responseTimeMs) : 5000;

    if (poll.type === 'quiz') {
      const correctTargetId = activeQuestion
        ? activeQuestion.correct_option_id
        : poll.correct_option_id;
      isCorrect = Boolean(correctTargetId && optionId === correctTargetId);
      const limitSec = activeQuestion
        ? activeQuestion.time_limit_seconds
        : poll.time_limit_seconds || 30;
      points = this.calculateQuizPoints(isCorrect, timeMs, limitSec);
    }

    // D. ATOMIC INSERTION INTO DATABASE
    const responseId =
      'resp_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const newResponse: PollResponse = {
      id: responseId,
      poll_id: poll.id,
      question_id: questionId,
      question_index: targetQIndex,
      option_id: optionId || null,
      rating_value: typeof ratingValue === 'number' ? ratingValue : null,
      participant_id: pid,
      participant_name: participantName
        ? String(participantName).trim().slice(0, 50)
        : 'Anonymous Student',
      response_time_ms: timeMs,
      points,
      is_correct: isCorrect,
      client_request_id: reqId,
      created_at: new Date().toISOString(),
    };

    // If Supabase is active, execute database insert directly
    if (this.isSupabaseActive && this.supabase) {
      const { error: dbError } = await this.supabase.from('responses').insert({
        id: newResponse.id,
        poll_id: newResponse.poll_id,
        question_id: newResponse.question_id,
        question_index: newResponse.question_index,
        option_id: newResponse.option_id,
        rating_value: newResponse.rating_value,
        participant_id: newResponse.participant_id,
        participant_name: newResponse.participant_name,
        response_time_ms: newResponse.response_time_ms,
        points: newResponse.points,
        is_correct: newResponse.is_correct,
        client_request_id: newResponse.client_request_id,
        created_at: newResponse.created_at,
      });

      if (dbError) {
        // Enforce database UNIQUE (poll_id, participant_id, question_index) constraint
        if (
          dbError.code === '23505' ||
          dbError.message?.includes('unique') ||
          dbError.message?.includes('duplicate')
        ) {
          const err: any = new Error('You have already submitted your response for this question.');
          err.code = '23505';
          err.status = 409;
          throw err;
        }
        throw dbError;
      }
    }

    // Persistent table insertion:
    // Strictly enforces database UNIQUE constraint (code 23505) at database insertion point
    const hasExistingVote = this.tableResponses.some(
      (r) =>
        r.poll_id === poll.id &&
        r.participant_id === pid &&
        (r.question_index ?? 0) === targetQIndex
    );
    if (hasExistingVote) {
      const err: any = new Error('You have already submitted your response for this question.');
      err.code = '23505';
      err.status = 409;
      throw err;
    }

    this.tableResponses.push(newResponse);

    // Compute cumulative score
    const studentVotes = this.tableResponses.filter(
      (r) => r.poll_id === poll.id && r.participant_id === pid
    );
    const totalScore = studentVotes.reduce((sum, r) => sum + (r.points ?? 0), 0);

    const resultPayload = {
      success: true,
      response: newResponse,
      responseId: newResponse.id,
      points,
      totalScore,
      isCorrect,
      selectedOptionId: optionId || null,
      questionIndex: targetQIndex,
      totalQuestions: poll.questions?.length || 1,
    };

    // Store in idempotency table for safe retries
    if (reqId) {
      this.tableIdempotency.set(reqId, {
        status: 201,
        body: resultPayload,
        timestamp: Date.now(),
      });
    }

    this.flushToDisk();
    return resultPayload;
  }

  // =========================================================
  // 6. LIVE RESULTS AGGREGATION (GET /api/polls/:id/results)
  // =========================================================

  public async getPollResults(pollId: string) {
    const poll = await this.getPollByIdOrCode(pollId);
    if (!poll) return null;

    const currentIdx = poll.current_question_index ?? 0;
    const activeQ =
      poll.questions && poll.questions[currentIdx] ? poll.questions[currentIdx] : null;
    const currentOptions = activeQ ? activeQ.options : poll.options || [];

    let totalResponses = 0;
    const optionCounts = new Map<string, number>();

    if (this.isSupabaseActive && this.supabase) {
      try {
        // SQL Count query: Exact total responses for this poll & question
        const { count: dbTotal } = await this.supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('poll_id', poll.id)
          .eq('question_index', currentIdx);
        totalResponses = dbTotal || 0;

        // SQL Count per option
        for (const opt of currentOptions) {
          const { count: optCount } = await this.supabase
            .from('responses')
            .select('*', { count: 'exact', head: true })
            .eq('poll_id', poll.id)
            .eq('question_index', currentIdx)
            .eq('option_id', opt.id);
          optionCounts.set(opt.id, optCount || 0);
        }
      } catch (err) {
        console.warn('[CampusVote DB] Supabase results aggregation error:', err);
      }
    }

    if (totalResponses === 0 && optionCounts.size === 0) {
      // Database table aggregation
      for (const r of this.tableResponses) {
        if (r.poll_id === poll.id && (r.question_index ?? 0) === currentIdx) {
          totalResponses++;
          if (r.option_id) {
            optionCounts.set(r.option_id, (optionCounts.get(r.option_id) || 0) + 1);
          }
        }
      }
    }

    const options = currentOptions.map((opt) => {
      const count = optionCounts.get(opt.id) || 0;
      const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
      return {
        id: opt.id,
        text: opt.option_text,
        order: opt.option_order,
        count,
        percentage,
      };
    });

    let averageRating: number | undefined;
    let ratingBreakdown: { rating: number; count: number; percentage: number }[] | undefined;

    if (poll.type === 'rating') {
      const ratingResponses = this.tableResponses.filter(
        (r) => r.poll_id === poll.id && typeof r.rating_value === 'number'
      );
      const sum = ratingResponses.reduce((acc, r) => acc + (r.rating_value || 0), 0);
      averageRating =
        ratingResponses.length > 0 ? Number((sum / ratingResponses.length).toFixed(1)) : 0;

      ratingBreakdown = [1, 2, 3, 4, 5].map((star) => {
        const count = ratingResponses.filter((r) => r.rating_value === star).length;
        const percentage =
          ratingResponses.length > 0 ? Math.round((count / ratingResponses.length) * 100) : 0;
        return { rating: star, count, percentage };
      });
    }

    let leaderboard: any[] | undefined;
    let topThree: any[] | undefined;
    let totalQuizParticipants: number | undefined;

    if (poll.type === 'quiz') {
      const allPollResponses = this.tableResponses.filter((r) => r.poll_id === poll.id);
      const participantMap = new Map<
        string,
        {
          participantId: string;
          participantName: string;
          totalPoints: number;
          totalResponseTimeMs: number;
          correctCount: number;
          questionsAnswered: number;
          lastAnsweredAt: string;
        }
      >();

      for (const r of allPollResponses) {
        const existing = participantMap.get(r.participant_id);
        const pts = r.points ?? 0;
        const time = r.response_time_ms ?? 0;
        const isCorr = Boolean(r.is_correct);

        if (!existing) {
          participantMap.set(r.participant_id, {
            participantId: r.participant_id,
            participantName: r.participant_name || 'Anonymous Student',
            totalPoints: pts,
            totalResponseTimeMs: time,
            correctCount: isCorr ? 1 : 0,
            questionsAnswered: 1,
            lastAnsweredAt: r.created_at,
          });
        } else {
          existing.totalPoints += pts;
          existing.totalResponseTimeMs += time;
          if (isCorr) existing.correctCount += 1;
          existing.questionsAnswered += 1;
          existing.lastAnsweredAt = r.created_at;
          if (r.participant_name && r.participant_name !== 'Anonymous Student') {
            existing.participantName = r.participant_name;
          }
        }
      }

      totalQuizParticipants = participantMap.size;
      const sortedParticipants = Array.from(participantMap.values()).sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        return a.totalResponseTimeMs - b.totalResponseTimeMs;
      });

      leaderboard = sortedParticipants.slice(0, 10).map((p, index) => ({
        rank: index + 1,
        participantId: p.participantId,
        participantName: p.participantName,
        points: p.totalPoints,
        responseTimeMs: p.totalResponseTimeMs,
        isCorrect: p.correctCount > 0,
        answeredAt: p.lastAnsweredAt,
        questionsAnswered: p.questionsAnswered,
      }));

      topThree = sortedParticipants.slice(0, 3).map((p, index) => ({
        rank: index + 1,
        participantId: p.participantId,
        participantName: p.participantName,
        points: p.totalPoints,
        isCorrect: p.correctCount > 0,
      }));
    }

    return {
      poll,
      totalResponses,
      options,
      averageRating,
      ratingBreakdown,
      leaderboard,
      topThree,
      totalQuizParticipants,
      currentQuestionIndex: currentIdx,
      totalQuestions: poll.questions?.length || 1,
    };
  }

  // =========================================================
  // 7. PARTICIPANT VOTED CHECK (GET /api/polls/:id/voted/:participantId)
  // =========================================================

  public async getParticipantVoteStatus(
    pollId: string,
    participantId: string,
    questionIndex?: number
  ) {
    const poll = await this.getPollByIdOrCode(pollId);
    if (!poll) return { voted: false, hasVoted: false };

    const targetIdx =
      typeof questionIndex === 'number' ? questionIndex : poll.current_question_index ?? 0;

    let qResponse: PollResponse | null = null;
    let allStudentResponses: PollResponse[] = [];

    if (this.isSupabaseActive && this.supabase) {
      try {
        const { data: records } = await this.supabase
          .from('responses')
          .select('*')
          .eq('poll_id', poll.id)
          .eq('participant_id', participantId);

        if (records && records.length > 0) {
          allStudentResponses = records;
          qResponse =
            records.find((r) => (r.question_index ?? 0) === targetIdx) || null;
        }
      } catch (err) {
        console.warn('[CampusVote DB] Supabase getParticipantVoteStatus error:', err);
      }
    }

    if (!qResponse && allStudentResponses.length === 0) {
      allStudentResponses = this.tableResponses.filter(
        (r) => r.poll_id === poll.id && r.participant_id === participantId
      );
      qResponse =
        allStudentResponses.find((r) => (r.question_index ?? 0) === targetIdx) || null;
    }

    const totalScore = allStudentResponses.reduce((sum, r) => sum + (r.points ?? 0), 0);

    return {
      voted: Boolean(qResponse),
      hasVoted: Boolean(qResponse),
      points: qResponse?.points,
      isCorrect: qResponse?.is_correct,
      totalScore,
      participantName:
        qResponse?.participant_name || allStudentResponses[0]?.participant_name,
      optionId: qResponse?.option_id,
      selectedOptionId: qResponse?.option_id,
      questionIndex: targetIdx,
      answeredCount: allStudentResponses.length,
      currentQuestionIndex: poll.current_question_index ?? 0,
      quizState: poll.quiz_state,
      status: poll.status,
    };
  }

  private calculateQuizPoints(
    isCorrect: boolean,
    responseTimeMs: number,
    maxTimeSeconds: number = 30
  ): number {
    if (!isCorrect) return 0;
    const maxMs = maxTimeSeconds * 1000;
    const clampedTime = Math.min(Math.max(responseTimeMs, 500), maxMs);
    const timeFactor = 1 - clampedTime / maxMs;
    const speedBonus = Math.round(500 * Math.max(timeFactor, 0.05));
    return 500 + speedBonus;
  }
}

export const db = new CampusVoteDatabase();
