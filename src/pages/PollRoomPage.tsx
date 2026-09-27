import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Vote,
  Play,
  Square,
  BarChart2,
  Presentation,
  Copy,
  Check,
  Users,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Maximize2,
  Zap,
  ArrowRight,
  Trophy,
  Flame,
  Layers,
} from 'lucide-react';
import { Poll, PollResults, PollStatus } from '../types/poll';
import {
  getPoll,
  getPollResults,
  updatePollStatus,
  subscribeToPollUpdates,
  startQuiz,
  nextQuizQuestion,
  endQuizQuestion,
  endQuiz,
} from '../lib/pollService';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { ResultChart } from '../components/ResultChart';
import { getPublicVotingUrl } from '../lib/urlHelper';

export const PollRoomPage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();
  const navigate = useNavigate();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadData = async () => {
    if (!pollId) return;
    try {
      const p = await getPoll(pollId);
      if (p) {
        setPoll(p);
        const res = await getPollResults(p.id);
        setResults(res);
      }
    } catch (err) {
      console.error('Error loading poll room data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!pollId) return;

    // Realtime subscription: updates when students vote
    const unsubscribe = subscribeToPollUpdates(pollId, () => {
      loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [pollId]);

  const handleStatusChange = async (newStatus: PollStatus) => {
    if (!poll) return;
    setActionLoading(true);
    try {
      const updated = await updatePollStatus(poll.id, newStatus);
      if (updated) {
        setPoll(updated);
        const res = await getPollResults(updated.id);
        setResults(res);
      }
    } catch (err) {
      console.error('Failed to change poll status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const votingUrl = poll ? getPublicVotingUrl(poll.id) : '';

  const handleCopyLink = async () => {
    if (!votingUrl) return;
    try {
      await navigator.clipboard.writeText(votingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center animate-spin mb-4">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-500 font-medium">Loading poll room...</p>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="clay-card p-8 flex flex-col items-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Poll Not Found</h2>
          <p className="text-xs text-slate-500 mb-6">
            The requested poll room does not exist or has been removed.
          </p>
          <Link to="/host" className="px-5 py-2.5 text-xs font-bold text-white clay-btn-primary rounded-xl">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Back and Navigation */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Link
          to="/host"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Host Dashboard</span>
        </Link>

        {/* Live Presentation Button */}
        <Link
          to={`/poll/${poll.id}/present`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 text-xs font-bold text-white clay-btn-primary rounded-xl flex items-center gap-2 shadow-md cursor-pointer"
        >
          <Presentation className="w-4 h-4" />
          <span>Presentation Mode</span>
          <ExternalLink className="w-3 h-3 opacity-80" />
        </Link>
      </div>

      {/* Main Room Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Poll Info & QR Code (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Card: Poll Status & Controls */}
          <div className="clay-card p-6 sm:p-7 flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                  poll.quiz_state === 'completed'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold'
                    : poll.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse'
                    : poll.status === 'draft'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {poll.quiz_state === 'completed'
                  ? '🏆 Tournament Completed · Podium Live'
                  : poll.status === 'active'
                  ? poll.type === 'quiz'
                    ? '● Speed Quiz Live'
                    : '● Live Voting Active'
                  : poll.status}
              </span>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-mono tabular-nums text-slate-900 font-bold">
                  {results ? (results.totalQuizParticipants || results.totalResponses) : 0}
                </span>
                <span>{poll.type === 'quiz' ? 'players' : 'votes'}</span>
              </div>
            </div>

            {/* Quiz Info & Progress */}
            {poll.type === 'quiz' && (
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-4 h-4 fill-amber-500" />
                    <span>Speed Quiz Progress</span>
                  </span>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-200 text-amber-950">
                    {poll.quiz_state === 'completed'
                      ? 'Completed (All Questions)'
                      : `Question ${(poll.current_question_index ?? 0) + 1} of ${poll.questions?.length || 1}`}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {poll.quiz_state === 'completed'
                    ? 'Quiz is completed! Students see their position in number and the top 3 podium. Host sees the top 10 leaderboard below.'
                    : 'Advancing to the next question triggers a 3-second warning countdown on student screens before flashing the question.'}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-1">
                <span>{poll.title}</span>
                {poll.type === 'quiz' && (
                  <span className="text-amber-700 font-bold font-mono">
                    Q{(poll.current_question_index ?? 0) + 1}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {poll.question}
              </h1>
            </div>

            {/* Host Quiz & Poll Controls */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
              {poll.type === 'quiz' ? (
                <>
                  {/* Quiz Host Controls */}
                  {poll.quiz_state === 'completed' ? (
                    /* QUIZ COMPLETED HOST ACTIONS */
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-5 h-5 fill-white" />
                          <span className="font-extrabold text-sm sm:text-base">Final Podium Active!</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase font-black bg-black/20 px-2 py-0.5 rounded-full text-amber-100">
                          Ended
                        </span>
                      </div>
                      <p className="text-xs text-amber-100">
                        Students are viewing their position in number only + the Top 3 Podium. The full Top 10 Leaderboard is visible below for the Host.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                        <Link
                          to={`/poll/${poll.id}/present`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:flex-1 py-2.5 text-xs font-bold text-slate-900 bg-white hover:bg-amber-50 rounded-xl flex items-center justify-center gap-1.5 shadow transition-all"
                        >
                          <Presentation className="w-4 h-4 text-amber-600" />
                          <span>Open Presentation Podium</span>
                        </Link>
                        <button
                          disabled={actionLoading}
                          onClick={async () => {
                            setActionLoading(true);
                            try {
                              await startQuiz(poll.id);
                              await loadData();
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-white bg-black/25 hover:bg-black/40 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          title="Restart Quiz from Q1"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Restart</span>
                        </button>
                      </div>
                    </div>
                  ) : poll.status === 'draft' || poll.quiz_state === 'lobby' ? (
                    <button
                      disabled={actionLoading}
                      onClick={async () => {
                        setActionLoading(true);
                        try {
                          await startQuiz(poll.id);
                          await loadData();
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className="w-full py-3.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Quiz (Question 1)</span>
                    </button>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      {/* Next Question Button or End Quiz Button */}
                      {(poll.current_question_index ?? 0) < (poll.questions?.length || 1) - 1 ? (
                        <>
                          <button
                            disabled={actionLoading}
                            onClick={async () => {
                              setActionLoading(true);
                              try {
                                await nextQuizQuestion(poll.id);
                                await loadData();
                              } finally {
                                setActionLoading(false);
                              }
                            }}
                            className="flex-1 w-full py-3 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <span>Next Question (Q{(poll.current_question_index ?? 0) + 2} of {poll.questions?.length || 1})</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                          <button
                            disabled={actionLoading}
                            onClick={async () => {
                              setActionLoading(true);
                              try {
                                await endQuiz(poll.id);
                                await loadData();
                                setTimeout(() => {
                                  document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
                                }, 100);
                              } finally {
                                setActionLoading(false);
                              }
                            }}
                            className="px-3.5 py-3 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0"
                            title="End Quiz now & reveal final podium"
                          >
                            <Trophy className="w-4 h-4 inline mr-1" />
                            <span>End Early</span>
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={actionLoading}
                          onClick={async () => {
                            setActionLoading(true);
                            try {
                              await endQuiz(poll.id);
                              await loadData();
                              setTimeout(() => {
                                document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
                              }, 100);
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          className="flex-1 w-full py-3.5 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <Trophy className="w-4 h-4" />
                          <span>End Quiz & View Final Podium</span>
                        </button>
                      )}

                      {/* Close / Reopen */}
                      {poll.status === 'active' ? (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleStatusChange('closed')}
                          className="px-4 py-3 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                          title="Close responses"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          disabled={actionLoading}
                          onClick={() => handleStatusChange('active')}
                          className="px-4 py-3 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                          title="Reopen responses"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* Standard Poll Controls */
                <div className="flex items-center gap-3">
                  {poll.status === 'draft' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleStatusChange('active')}
                      className="flex-1 py-3 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Start Poll (Open for Students)</span>
                    </button>
                  )}

                  {poll.status === 'active' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleStatusChange('closed')}
                      className="flex-1 py-3 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>Close Poll (Stop Responses)</span>
                    </button>
                  )}

                  {poll.status === 'closed' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleStatusChange('active')}
                      className="flex-1 py-3 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Reopen Poll</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card: High Density QR Code */}
          <div className="clay-card p-6 sm:p-7 flex flex-col items-center w-full overflow-hidden">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Audience QR Code
            </h3>
            <p className="text-xs text-slate-500 mb-4 text-center">
              Display this on screen for students and attendees to scan
            </p>

            <QRCodeDisplay
              pollId={poll.id}
              joinCode={poll.join_code}
              size={200}
              showDetails={true}
            />
          </div>
        </div>

        {/* Right Column: Live Results Stream (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="clay-card p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Live Response Results
                  </h2>
                  <p className="text-xs text-slate-500">
                    Updates in real-time as students submit their answers
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  to={`/poll/${poll.id}/results`}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                >
                  Full Results Page
                </Link>
              </div>
            </div>

            {/* Results Chart Display */}
            {results && (results.totalResponses > 0 || poll.type === 'quiz' || poll.status === 'closed') ? (
              <div id="results-section">
                <ResultChart results={results} presentation={false} />
              </div>
            ) : (
              <div className="py-16 text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  Waiting for First Responses...
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                  {poll.status === 'active'
                    ? 'Share the QR code with your audience. Results will stream in automatically.'
                    : 'The poll is currently in draft. Click "Start Poll" to begin accepting responses.'}
                </p>

                {poll.status === 'active' && (
                  <a
                    href={votingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>Cast a test vote now</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
