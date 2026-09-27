import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Zap,
  Timer,
  CheckCircle,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  Check,
  Flame,
  Layers,
  ArrowRight,
  HelpCircle,
  ListOrdered,
} from 'lucide-react';
import { createPoll } from '../lib/pollService';

interface QuizQuestionDraft {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  timeLimitSeconds: number;
}

interface QuizPreset {
  name: string;
  title: string;
  questions: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    timeLimit: number;
  }>;
}

const QUIZ_PRESETS: QuizPreset[] = [
  {
    name: 'CS Data Structures',
    title: 'CS301: Data Structures Speed Blitz',
    questions: [
      {
        question: 'What is the average time complexity of lookups in a balanced Binary Search Tree?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctIndex: 1,
        timeLimit: 30,
      },
      {
        question: 'Which data structure strictly operates on the LIFO (Last-In First-Out) principle?',
        options: ['Queue', 'Stack', 'Linked List', 'Priority Queue'],
        correctIndex: 1,
        timeLimit: 20,
      },
      {
        question: 'What is the worst-case search time complexity of an unhandled hash collision in a Hash Table?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
        correctIndex: 2,
        timeLimit: 25,
      },
    ],
  },
  {
    name: 'Web Tech & Cloud',
    title: 'Full-Stack Architecture Quiz',
    questions: [
      {
        question: 'Which HTTP status code signifies that a resource was permanently moved?',
        options: ['200 OK', '301 Moved Permanently', '404 Not Found', '502 Bad Gateway'],
        correctIndex: 1,
        timeLimit: 20,
      },
      {
        question: 'Which protocol is primarily used for bidirectional, full-duplex real-time client communication?',
        options: ['HTTP/1.1', 'WebSocket', 'FTP', 'SMTP'],
        correctIndex: 1,
        timeLimit: 20,
      },
      {
        question: 'What does DNS stand for in computer networking?',
        options: ['Domain Name System', 'Dynamic Network Server', 'Digital Node Service', 'Data Network Switch'],
        correctIndex: 0,
        timeLimit: 20,
      },
    ],
  },
  {
    name: 'Algorithms & Sorting',
    title: 'Algorithm Speed Drill',
    questions: [
      {
        question: 'Which sorting algorithm has a guaranteed worst-case time complexity of O(n log n)?',
        options: ['Quick Sort', 'Merge Sort', 'Bubble Sort', 'Insertion Sort'],
        correctIndex: 1,
        timeLimit: 25,
      },
      {
        question: 'Which algorithm finds the shortest path in a weighted graph with non-negative edge weights?',
        options: ["Dijkstra's Algorithm", "Kruskal's Algorithm", "Prim's Algorithm", 'Depth First Search (DFS)'],
        correctIndex: 0,
        timeLimit: 30,
      },
      {
        question: 'What is the time complexity of binary search on a pre-sorted array of size n?',
        options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
        correctIndex: 1,
        timeLimit: 20,
      },
    ],
  },
  {
    name: 'Campus Trivia',
    title: 'College Tech Fest Trivia',
    questions: [
      {
        question: 'In which year was the World Wide Web made publicly available by Tim Berners-Lee?',
        options: ['1983', '1991', '1995', '2000'],
        correctIndex: 1,
        timeLimit: 20,
      },
      {
        question: 'Which programming language was created by Brendan Eich in just 10 days in 1995?',
        options: ['Python', 'Java', 'JavaScript', 'Ruby'],
        correctIndex: 2,
        timeLimit: 20,
      },
      {
        question: 'What was the name of the first computer virus created for MS-DOS PCs in 1986?',
        options: ['Creeper', 'Brain', 'Melissa', 'ILOVEYOU'],
        correctIndex: 1,
        timeLimit: 20,
      },
    ],
  },
];

const OPTION_THEMES = [
  { letter: 'A', bg: 'bg-rose-500', border: 'border-rose-300', text: 'text-rose-700' },
  { letter: 'B', bg: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-700' },
  { letter: 'C', bg: 'bg-amber-500', border: 'border-amber-300', text: 'text-amber-700' },
  { letter: 'D', bg: 'bg-emerald-500', border: 'border-emerald-300', text: 'text-emerald-700' },
  { letter: 'E', bg: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-700' },
  { letter: 'F', bg: 'bg-indigo-500', border: 'border-indigo-300', text: 'text-indigo-700' },
];

export const CreateQuizPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('Speed Quiz: 3-Question Challenge');
  const [questions, setQuestions] = useState<QuizQuestionDraft[]>([
    {
      id: 'q-1',
      question: 'What is the average time complexity of lookups in a balanced Binary Search Tree?',
      options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
      correctOptionIndex: 1,
      timeLimitSeconds: 30,
    },
    {
      id: 'q-2',
      question: 'Which HTTP status code signifies that a resource was permanently moved?',
      options: ['200 OK', '301 Moved Permanently', '404 Not Found', '502 Bad Gateway'],
      correctOptionIndex: 1,
      timeLimitSeconds: 20,
    },
    {
      id: 'q-3',
      question: 'Which sorting algorithm has a guaranteed worst-case time complexity of O(n log n)?',
      options: ['Quick Sort', 'Merge Sort', 'Bubble Sort', 'Insertion Sort'],
      correctOptionIndex: 1,
      timeLimitSeconds: 25,
    },
  ]);

  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeQ = questions[activeQuestionIndex] || questions[0];

  const applyPreset = (preset: QuizPreset) => {
    setTitle(preset.title);
    setQuestions(
      preset.questions.map((q, idx) => ({
        id: `q-${idx + 1}`,
        question: q.question,
        options: [...q.options],
        correctOptionIndex: q.correctIndex,
        timeLimitSeconds: q.timeLimit,
      }))
    );
    setActiveQuestionIndex(0);
    setErrorMessage('');
  };

  const handleAddQuestion = () => {
    if (questions.length >= 10) {
      setErrorMessage('A maximum of 10 questions per quiz session is recommended for high engagement.');
      return;
    }
    const newQ: QuizQuestionDraft = {
      id: `q-${Date.now()}`,
      question: '',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctOptionIndex: 0,
      timeLimitSeconds: 30,
    };
    setQuestions([...questions, newQ]);
    setActiveQuestionIndex(questions.length);
    setErrorMessage('');
  };

  const handleRemoveQuestion = (indexToRemove: number) => {
    if (questions.length <= 1) {
      setErrorMessage('A quiz must have at least 1 question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== indexToRemove);
    setQuestions(updated);
    if (activeQuestionIndex >= updated.length) {
      setActiveQuestionIndex(updated.length - 1);
    }
    setErrorMessage('');
  };

  const handleUpdateActiveQuestion = (field: keyof QuizQuestionDraft, value: any) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[activeQuestionIndex] = {
        ...copy[activeQuestionIndex],
        [field]: value,
      };
      return copy;
    });
    setErrorMessage('');
  };

  const handleAddOptionToActiveQ = () => {
    if (activeQ.options.length >= 6) {
      setErrorMessage('A maximum of 6 options is recommended for rapid mobile answering.');
      return;
    }
    const nextLetter = String.fromCharCode(65 + activeQ.options.length);
    handleUpdateActiveQuestion('options', [...activeQ.options, `Option ${nextLetter}`]);
  };

  const handleRemoveOptionFromActiveQ = (optIndex: number) => {
    if (activeQ.options.length <= 2) {
      setErrorMessage('Quiz questions require at least 2 options.');
      return;
    }
    const newOpts = activeQ.options.filter((_, i) => i !== optIndex);
    let newCorrect = activeQ.correctOptionIndex;
    if (newCorrect >= newOpts.length) {
      newCorrect = 0;
    }
    setQuestions((prev) => {
      const copy = [...prev];
      copy[activeQuestionIndex] = {
        ...copy[activeQuestionIndex],
        options: newOpts,
        correctOptionIndex: newCorrect,
      };
      return copy;
    });
    setErrorMessage('');
  };

  const handleOptionChange = (optIndex: number, text: string) => {
    const newOpts = [...activeQ.options];
    newOpts[optIndex] = text;
    handleUpdateActiveQuestion('options', newOpts);
  };

  const validate = (): boolean => {
    if (!title.trim()) {
      setErrorMessage('Please enter a quiz competition title.');
      return false;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        setErrorMessage(`Question #${i + 1} has an empty question text. Please enter the question.`);
        setActiveQuestionIndex(i);
        return false;
      }
      const cleanOpts = q.options.map((o) => o.trim()).filter(Boolean);
      if (cleanOpts.length < 2) {
        setErrorMessage(`Question #${i + 1} requires at least 2 valid option choices.`);
        setActiveQuestionIndex(i);
        return false;
      }
      const unique = new Set(cleanOpts.map((o) => o.toLowerCase()));
      if (unique.size !== cleanOpts.length) {
        setErrorMessage(`Question #${i + 1} has duplicate option choices.`);
        setActiveQuestionIndex(i);
        return false;
      }
      if (q.correctOptionIndex < 0 || q.correctOptionIndex >= cleanOpts.length) {
        setErrorMessage(`Question #${i + 1} requires a designated correct answer choice.`);
        setActiveQuestionIndex(i);
        return false;
      }
    }
    return true;
  };

  const handleCreateAndLaunch = async () => {
    setErrorMessage('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      const formattedQuestions = questions.map((q) => ({
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        correctOptionIndex: q.correctOptionIndex,
        timeLimitSeconds: q.timeLimitSeconds,
      }));

      const newPoll = await createPoll({
        title: title.trim(),
        type: 'quiz',
        questions: formattedQuestions,
      });

      navigate(`/poll/${newPoll.id}/room`);
    } catch (err) {
      console.error('Error creating quiz:', err);
      setErrorMessage('An unexpected error occurred while creating the quiz.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Link
          to="/host"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Host Dashboard</span>
        </Link>

        <Link
          to="/create-poll"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 transition-colors shadow-xs"
        >
          <span>Switch to Standard Poll (MCQ / Yes-No / Rating)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Main Quiz Builder Card */}
      <div className="clay-card p-6 sm:p-10 border-2 border-amber-300/80 bg-gradient-to-b from-amber-50/20 via-white to-white">
        {/* Quiz Mode Header Banner */}
        <div className="pb-6 border-b border-amber-200/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
                <Zap className="w-6 h-6 fill-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Speed Quiz Competition
                  </h1>
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                    Multi-Question Live Game
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Students see questions from Question 1 to the end. Fast answers earn up to <strong>1,000 pts</strong> per question and cumulative points add up across the game!
                </p>
              </div>
            </div>

            {/* Speed rule tag */}
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-2xl self-start md:self-auto">
              <Flame className="w-4 h-4 text-amber-600" />
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">
                  Host-Controlled
                </span>
                <span className="text-xs font-mono font-bold text-amber-950">
                  3s Warning Timer on Q Change
                </span>
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="mt-6 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Quick Templates (Multi-Question):
            </span>
            {QUIZ_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100/70 border border-amber-200 text-slate-700 hover:text-amber-900 transition-colors cursor-pointer"
              >
                {preset.name} ({preset.questions.length} Qs)
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Quiz Title */}
        <div className="mt-6">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Quiz Round / Tournament Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. CS Speed Challenge: Data Structures or Freshers Quiz"
            className="w-full px-4 py-3 text-sm rounded-xl clay-input text-slate-900 font-semibold placeholder:font-normal placeholder:text-slate-400"
          />
        </div>

        {/* Multi-Question Tabs & Navigation */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Quiz Questions ({questions.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Students answer Question 1, 2, 3 in sequence as host advances.
            </span>
          </div>

          {/* Question Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {questions.map((q, idx) => {
              const isActive = idx === activeQuestionIndex;
              return (
                <button
                  key={q.id || idx}
                  type="button"
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 ring-2 ring-amber-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-md text-[11px] font-mono font-black flex items-center justify-center ${
                      isActive ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span>Question {idx + 1}</span>
                  {q.question ? (
                    <CheckCircle className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-emerald-500'}`} />
                  ) : null}
                </button>
              );
            })}

            {/* Add Question Button */}
            {questions.length < 10 && (
              <button
                type="button"
                onClick={handleAddQuestion}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-amber-50 text-amber-900 border-2 border-dashed border-amber-300 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>Add Question #{questions.length + 1}</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Question Editor Card */}
        <div className="mt-4 p-5 sm:p-7 rounded-2xl bg-amber-50/40 border border-amber-200/80 flex flex-col gap-6">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200/50">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-amber-500 text-white font-mono font-extrabold text-xs flex items-center justify-center shadow-xs">
                #{activeQuestionIndex + 1}
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Editing Question #{activeQuestionIndex + 1} of {questions.length}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Question Time Limit */}
              <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-amber-200">
                <Timer className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[11px] font-bold text-slate-500 uppercase">Limit:</span>
                <select
                  value={activeQ.timeLimitSeconds}
                  onChange={(e) => handleUpdateActiveQuestion('timeLimitSeconds', Number(e.target.value))}
                  className="text-xs font-bold text-slate-900 bg-transparent cursor-pointer focus:outline-none"
                >
                  <option value={15}>15s (Blitz)</option>
                  <option value={20}>20s (Fast)</option>
                  <option value={25}>25s</option>
                  <option value={30}>30s (Std)</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                </select>
              </div>

              {/* Delete Question */}
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveQuestion(activeQuestionIndex)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                  title="Delete this question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Question Text for Students
            </label>
            <textarea
              rows={2}
              value={activeQ.question}
              onChange={(e) => handleUpdateActiveQuestion('question', e.target.value)}
              placeholder={`e.g. Enter question #${activeQuestionIndex + 1}...`}
              className="w-full px-4 py-3 text-sm sm:text-base rounded-xl clay-input bg-white text-slate-900 font-medium placeholder:text-slate-400 leading-relaxed"
            />
          </div>

          {/* Options & Correct Answer Selection */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Answer Choices
                </span>
                <p className="text-[11px] text-slate-500">
                  Tap <span className="text-emerald-700 font-bold">Mark Correct</span> on the right choice (answer remains secret from students until vote).
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-lg">
                {activeQ.options.length} Choices
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeQ.options.map((opt, optIdx) => {
                const isCorrect = activeQ.correctOptionIndex === optIdx;
                const theme = OPTION_THEMES[optIdx % OPTION_THEMES.length];

                return (
                  <div
                    key={optIdx}
                    className={`p-3.5 rounded-2xl border-2 transition-all relative flex flex-col gap-2 ${
                      isCorrect
                        ? 'bg-emerald-50/90 border-emerald-500 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-300/50'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-7 h-7 rounded-lg ${theme.bg} text-white font-mono font-extrabold text-xs flex items-center justify-center shadow-xs`}
                        >
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          Option {String.fromCharCode(65 + optIdx)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUpdateActiveQuestion('correctOptionIndex', optIdx)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isCorrect
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isCorrect ? 'Correct Answer' : 'Mark Correct'}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)} text...`}
                        className="flex-1 px-3 py-2 text-sm rounded-xl clay-input bg-white font-semibold text-slate-900"
                      />

                      <button
                        type="button"
                        disabled={activeQ.options.length <= 2}
                        onClick={() => handleRemoveOptionFromActiveQ(optIdx)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        title="Delete option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {activeQ.options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOptionToActiveQ}
                className="py-2.5 px-4 text-xs font-bold text-amber-900 bg-white hover:bg-amber-50 border-2 border-dashed border-amber-300 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>Add Option {String.fromCharCode(65 + activeQ.options.length)}</span>
              </button>
            )}
          </div>
        </div>

        {/* Submission Actions */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Layers className="w-4 h-4 text-slate-400" />
            <span>
              All <strong>{questions.length} questions</strong> will be saved under one live quiz with a single join PIN!
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Secondary button: Add another question */}
            <button
              type="button"
              disabled={submitting || questions.length >= 10}
              onClick={handleAddQuestion}
              className="flex-1 sm:flex-none px-4 py-3 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Question</span>
            </button>

            {/* Primary button: Launch Complete Quiz */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleCreateAndLaunch}
              className="flex-1 sm:flex-none px-6 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{submitting ? 'Creating Quiz...' : `Launch Live Quiz (${questions.length} Questions)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
