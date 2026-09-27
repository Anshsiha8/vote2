import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  Vote,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Star,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Zap,
  Trophy,
  User,
  Timer,
  Check,
  XCircle,
  Lock,
  ArrowRight,
  Flame,
  Award,
} from 'lucide-react';
import { Poll, PodiumEntry } from '../types/poll';
import {
  getPoll,
  getPollResults,
  getParticipantVoteStatus,
  submitResponse,
  subscribeToPollUpdates,
  activateQuizQuestion,
} from '../lib/pollService';
import { getParticipantName, saveParticipantName, getLocalVoteRecord } from '../lib/participant';
import { TopThreePodium } from '../components/TopThreePodium';

export const StudentVotePage: React.FC = () => {
  const { pollId } = useParams<{ pollId: string }>();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [voteSummary, setVoteSummary] = useState<string>('');
  const [markedOptionId, setMarkedOptionId] = useState<string | null>(null);
  const [awardedPoints, setAwardedPoints] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState<number>(0);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [userResponseTimeMs, setUserResponseTimeMs] = useState<number | null>(null);

  // Participant Name for Quiz
  const [studentName, setStudentName] = useState<string>(() => getParticipantName());
  const [nameConfirmed, setNameConfirmed] = useState<boolean>(() => Boolean(getParticipantName()));

  // Form selections
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(() => {
    try {
      const saved = sessionStorage.getItem(`cv_sel_${pollId}`);
      return saved || null;
    } catch {
      return null;
    }
  });
  const [selectedRating, setSelectedRating] = useState<number | null>(() => {
    try {
      const saved = sessionStorage.getItem(`cv_rat_${pollId}`);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });

  // Weak network & connection state tracking
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [retryStatusText, setRetryStatusText] = useState<string>('');
  const pendingSubmissionRef = useRef<boolean>(false);

  // Question tracking to detect when host changes question
  const lastQuestionIndexRef = useRef<number | null>(null);

  // 3-Second Warning Countdown Timer before flashing question
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Speed timer tracking
  const [startTimeMs, setStartTimeMs] = useState<number>(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const speedTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Tournament Final Standing & Top 3 Podium
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalParticipants, setTotalParticipants] = useState<number | null>(null);
  const [topThree, setTopThree] = useState<PodiumEntry[]>([]);
  const confettiFiredRef = useRef<boolean>(false);

  const checkStatus = async () => {
    if (!pollId) return;
    try {
      const p = await getPoll(pollId);
      if (!p) {
        setPoll(null);
        return;
      }
      setPoll(p);

      const currentQIdx = p.current_question_index ?? 0;

      // Check if host transitioned to a new question!
      if (lastQuestionIndexRef.current !== null && lastQuestionIndexRef.current !== currentQIdx) {
        // Question changed by host! Reset voting state for the new question
        setAlreadyVoted(false);
        setSubmittedSuccess(false);
        setSelectedOptionId(null);
        setVoteSummary('');
        setMarkedOptionId(null);
        setAwardedPoints(null);
        setWasCorrect(null);
        setUserResponseTimeMs(null);
        setStartTimeMs(Date.now());
        setElapsedSeconds(0);
        setErrorMessage('');
      }
      lastQuestionIndexRef.current = currentQIdx;

      // Check participant vote status for this question
      const voteStatus = await getParticipantVoteStatus(p.id, undefined, currentQIdx);
      if (typeof voteStatus.totalScore === 'number') {
        setTotalScore(voteStatus.totalScore);
      }
      if (voteStatus.participantName) {
        setStudentName(voteStatus.participantName);
        setNameConfirmed(true);
      }
      if (typeof voteStatus.userRank === 'number') {
        setUserRank(voteStatus.userRank);
      }
      if (typeof voteStatus.totalParticipants === 'number') {
        setTotalParticipants(voteStatus.totalParticipants);
      }
      if (voteStatus.topThree && voteStatus.topThree.length > 0) {
        setTopThree(voteStatus.topThree);
      } else if (p.type === 'quiz') {
        // Fallback to fetch live results to populate topThree podium
        getPollResults(p.id).then((res) => {
          if (res?.topThree && res.topThree.length > 0) {
            setTopThree(res.topThree);
          } else if (res?.leaderboard && res.leaderboard.length > 0) {
            setTopThree(
              res.leaderboard.slice(0, 3).map((l) => ({
                rank: l.rank,
                participantId: l.participantId,
                participantName: l.participantName,
                points: l.points,
                isCorrect: l.isCorrect,
              }))
            );
          }
        }).catch(() => {});
      }

      if (voteStatus.voted) {
        setAlreadyVoted(true);
        setVoteSummary(voteStatus.choiceSummary || '');
        setAwardedPoints(voteStatus.points ?? null);
        setWasCorrect(voteStatus.isCorrect ?? null);
        setMarkedOptionId(voteStatus.selectedOptionId ?? null);
      }

      // Check countdown state
      handleCountdownState(p);
    } catch (err) {
      console.error('Error fetching poll:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle the 3-second countdown warning before flashing the question
  const handleCountdownState = (p: Poll) => {
    if (p.type === 'quiz' && (p.quiz_state === 'countdown' || p.countdown_end_at)) {
      if (p.countdown_end_at) {
        const endTime = new Date(p.countdown_end_at).getTime();
        const diffSeconds = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

        if (diffSeconds > 0) {
          setCountdownRemaining(diffSeconds);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

          countdownIntervalRef.current = setInterval(() => {
            const currentDiff = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
            setCountdownRemaining(currentDiff);
            if (currentDiff <= 0) {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              setCountdownRemaining(null);
              // Trigger activation if still marked countdown
              if (p.quiz_state === 'countdown') {
                activateQuizQuestion(p.id).catch(() => {});
              }
            }
          }, 200);
        } else {
          setCountdownRemaining(null);
        }
      } else {
        setCountdownRemaining(3);
      }
    } else {
      setCountdownRemaining(null);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
  };

  useEffect(() => {
    checkStatus();

    if (!pollId) return;

    // Real-time synchronization when host changes question or status
    const unsubscribe = subscribeToPollUpdates(pollId, () => {
      checkStatus();
    });

    // Fallback polling every 2s for mobile devices (ensures phones switch immediately when host ends quiz)
    const fallbackTimer = setInterval(() => {
      checkStatus();
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(fallbackTimer);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [pollId]);

  // Quiz speed counter when question is active and not yet voted
  useEffect(() => {
    const isQuestionActive =
      poll?.type === 'quiz' &&
      poll.status === 'active' &&
      poll.quiz_state === 'active' &&
      countdownRemaining === null &&
      !alreadyVoted &&
      !submittedSuccess &&
      nameConfirmed;

    if (isQuestionActive) {
      setStartTimeMs(Date.now());
      setElapsedSeconds(0);
      speedTimerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (speedTimerRef.current) clearInterval(speedTimerRef.current);
    }

    return () => {
      if (speedTimerRef.current) clearInterval(speedTimerRef.current);
    };
  }, [
    poll?.id,
    poll?.type,
    poll?.status,
    poll?.quiz_state,
    poll?.current_question_index,
    countdownRemaining,
    alreadyVoted,
    submittedSuccess,
    nameConfirmed,
  ]);

  // Online / Offline network event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSelectOption = (optId: string) => {
    setSelectedOptionId(optId);
    setErrorMessage('');
    try {
      if (pollId) sessionStorage.setItem(`cv_sel_${pollId}`, optId);
    } catch {}
  };

  const handleSelectRating = (rating: number) => {
    setSelectedRating(rating);
    setErrorMessage('');
    try {
      if (pollId) sessionStorage.setItem(`cv_rat_${pollId}`, String(rating));
    } catch {}
  };

  const handleConfirmName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setErrorMessage('Please enter your name to join the live quiz competition.');
      return;
    }
    saveParticipantName(studentName);
    setNameConfirmed(true);
    setErrorMessage('');
    setStartTimeMs(Date.now());
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!poll) return;

    setErrorMessage('');

    if (poll.type === 'quiz') {
      if (!studentName.trim()) {
        setErrorMessage('Please enter your name first.');
        return;
      }
      if (!selectedOptionId) {
        setErrorMessage('Please tap your answer choice as fast as you can!');
        return;
      }
    } else if (poll.type === 'multiple_choice' && !selectedOptionId) {
      setErrorMessage('Please select one of the options.');
      return;
    } else if (poll.type === 'yes_no' && !selectedOptionId) {
      setErrorMessage('Please tap YES or NO.');
      return;
    } else if (poll.type === 'rating' && !selectedRating) {
      setErrorMessage('Please select a star rating from 1 to 5.');
      return;
    }

    let summary = '';
    if (poll.type === 'rating' && selectedRating) {
      summary = `${selectedRating} Star${selectedRating > 1 ? 's' : ''}`;
    } else if (selectedOptionId && poll.options) {
      const opt = poll.options.find((o) => o.id === selectedOptionId);
      summary = opt ? opt.option_text : 'Option Selected';
    }

    const responseTimeMs = Math.max(Date.now() - startTimeMs, 400);

    setSubmitting(true);
    setRetryStatusText('Sending vote to server...');
    pendingSubmissionRef.current = true;

    try {
      const res = await submitResponse(
        {
          pollId: poll.id,
          optionId: selectedOptionId || undefined,
          ratingValue: selectedRating || undefined,
          choiceSummary: summary,
          participantName: studentName.trim() || undefined,
          responseTimeMs,
          questionIndex: poll.current_question_index ?? 0,
        },
        {
          onStatusChange: (status, msg) => {
            if (status === 'retrying') {
              setRetryStatusText(msg || 'Connection unstable — retrying vote...');
            } else if (status === 'submitting') {
              setRetryStatusText('Sending vote to server...');
            } else {
              setRetryStatusText('');
            }
          },
        }
      );

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to submit response.');
      } else {
        // Clear saved pending selection
        try {
          if (pollId) {
            sessionStorage.removeItem(`cv_sel_${pollId}`);
            sessionStorage.removeItem(`cv_rat_${pollId}`);
          }
        } catch {}

        setVoteSummary(summary);
        setAwardedPoints(typeof res.points === 'number' ? res.points : null);
        if (typeof res.totalScore === 'number') {
          setTotalScore(res.totalScore);
        } else if (typeof res.points === 'number') {
          setTotalScore((prev) => prev + (res.points || 0));
        }
        setWasCorrect(typeof res.isCorrect === 'boolean' ? res.isCorrect : null);
        setMarkedOptionId(res.selectedOptionId || selectedOptionId);
        setUserResponseTimeMs(responseTimeMs);
        setSubmittedSuccess(true);
        setAlreadyVoted(true);

        // Fire celebratory confetti for correct answer!
        try {
          if (res.isCorrect) {
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#10B981', '#F59E0B', '#6366F1', '#3B82F6'],
            });
          }
        } catch {}
      }
    } catch (err) {
      console.error('Submission error:', err);
      setErrorMessage('An unexpected network error occurred. Please check your connection and tap submit again.');
    } finally {
      setSubmitting(false);
      setRetryStatusText('');
      pendingSubmissionRef.current = false;
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center animate-spin mb-4">
          <RefreshCw className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-500">Connecting to live room...</p>
      </div>
    );
  }

  // Not Found State
  if (!poll) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex flex-col items-center justify-center p-4">
        <div className="clay-card p-8 max-w-sm w-full text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Poll Not Found</h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Please check the 6-character code or scan the QR code from the presenter screen again.
          </p>
          <Link
            to="/"
            className="w-full py-3 text-xs font-bold text-white clay-btn-primary rounded-xl"
          >
            Enter Another Code
          </Link>
        </div>
      </div>
    );
  }

  const currentQIndex = poll.current_question_index ?? 0;
  const totalQuestionsCount = poll.questions?.length || 1;

  // 1. QUIZ COMPLETED & FINAL PODIUM STATE (Highest priority for quiz when ended)
  // "when host press end quiz and view final podium the users shuld see there position in number only and the top three podium and for top 10 should be visible to host only"
  if (poll.type === 'quiz' && (poll.quiz_state === 'completed' || poll.status === 'closed')) {
    if (!confettiFiredRef.current) {
      confettiFiredRef.current = true;
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {}
    }

    return (
      <div className="min-h-screen bg-[#F4F6FB] flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
        <div className="max-w-md w-full flex flex-col items-center gap-5">
          {/* Header celebration */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black uppercase tracking-wider mb-2 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Tournament Finished</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Final Quiz Results
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Thank you for playing all {totalQuestionsCount} questions!
            </p>
          </div>

          {/* REQUIREMENT 1: User's position in number only */}
          <div className="w-full p-6 rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white shadow-xl shadow-indigo-950/25 border border-indigo-500/30 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

            <span className="text-[11px] font-black uppercase tracking-widest text-indigo-300 mb-1">
              Your Final Position
            </span>

            {/* Position In Number Only (Prominent Giant Number) */}
            <div className="my-2 flex items-baseline justify-center">
              <span className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-white drop-shadow-md">
                #{userRank ?? '—'}
              </span>
            </div>

            <p className="text-sm font-bold text-amber-300 mb-3">
              Position #{userRank ?? '—'} of {totalParticipants || 1} Players
            </p>

            <div className="w-full pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300">
                Player: <strong className="text-white font-sans">{studentName || 'Participant'}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-amber-300 font-bold">
                {totalScore} pts
              </span>
            </div>
          </div>

          {/* REQUIREMENT 2: The Top Three Podium */}
          <TopThreePodium
            entries={topThree}
            currentParticipantName={studentName}
            theme="light"
            title="🏆 Top 3 Grand Podium"
          />

          {/* REQUIREMENT 3: Top 10 visible to host only notice */}
          <div className="w-full p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3 text-xs text-slate-500">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="font-bold text-slate-700 block">Host-Only Detailed Leaderboard</span>
              <span className="text-[11px] text-slate-400">
                The full Top 10 leaderboard with player timings is displayed on the Host's projector screen.
              </span>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400">
            <span>Campus Vote · Speed Quiz Tournament</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Quiz Name Entry Step (Prompt for player's name first)
  if (poll.type === 'quiz' && !nameConfirmed) {
    return (
      <div className="min-h-screen bg-[#F4F6FB] py-8 px-4 sm:px-6 flex flex-col justify-center items-center">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-amber-600 tracking-wider uppercase mb-1">
              <Zap className="w-4 h-4 fill-amber-500" />
              <span>Speed Quiz Challenge</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Room Code: {poll.join_code}</p>
          </div>

          <div className="clay-card p-6 sm:p-8">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4">
              <User className="w-6 h-6" />
            </div>

            <h1 className="text-xl font-extrabold text-slate-900">
              Enter Your Name to Compete
            </h1>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Answer fast to get up to <strong>1,000 pts</strong> per question! Your score adds up across all questions.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleConfirmName} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Your Name or Nickname
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Alex Chen or SpeedDemon"
                  maxLength={30}
                  autoFocus
                  className="w-full px-4 py-3 text-base rounded-xl clay-input text-slate-900 font-bold placeholder:font-normal placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <span>Join Live Quiz!</span>
                <Zap className="w-4 h-4 fill-white" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 2. QUIZ LOBBY STATE (Waiting for host to start Question 1)
  if (poll.type === 'quiz' && poll.quiz_state === 'lobby') {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex flex-col items-center justify-center p-4">
        <div className="clay-card p-8 max-w-md w-full text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 border border-amber-200 shadow-md shadow-amber-500/10">
            <Zap className="w-8 h-8 fill-amber-500" />
          </div>

          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-100/80 px-3 py-1 rounded-full mb-3">
            ● Quiz Lobby
          </span>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            You're in the Game!
          </h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Waiting for the host to start <strong>Question 1</strong>. Keep your eyes on the screen!
          </p>

          {/* Player badge */}
          <div className="w-full p-4 rounded-2xl bg-white border border-slate-200 shadow-xs mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center shadow-xs">
                {studentName ? studentName.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Player Name
                </span>
                <span className="text-sm font-bold text-slate-900">{studentName}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Ready</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
            <span>Host will launch next question soon...</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. THREE-SECOND WARNING TIMER BEFORE FLASHING NEXT QUESTION!
  // "befor flashing the question a three second timer should appere on the user screen warning himto pay attention for next question"
  if (poll.type === 'quiz' && (countdownRemaining !== null || poll.quiz_state === 'countdown')) {
    const displayNum = countdownRemaining ?? 3;

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 flex flex-col items-center justify-center p-4 sm:p-6 text-white text-center selection:bg-white selection:text-orange-600 animate-in fade-in duration-200">
        <div className="max-w-md w-full flex flex-col items-center">
          {/* Warning Pulsing Tag */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/25 backdrop-blur-md border border-white/20 text-xs sm:text-sm font-black uppercase tracking-widest text-amber-200 animate-pulse mb-6 shadow-xl">
            <Flame className="w-4 h-4 text-amber-300" />
            <span>Pay Attention! Next Question</span>
          </div>

          {/* Question Indicator */}
          <h2 className="text-xl sm:text-2xl font-black text-white/90 uppercase tracking-wider mb-2">
            Question {currentQIndex + 1} of {totalQuestionsCount}
          </h2>

          <p className="text-sm sm:text-base text-amber-100 max-w-xs mb-8 font-medium">
            Get your fingers ready! The question is about to flash on screen.
          </p>

          {/* Huge Animated 3... 2... 1... Countdown Circle */}
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-white/15 backdrop-blur-lg border-4 border-white/40 flex items-center justify-center shadow-[0_0_60px_rgba(255,255,255,0.3)] mb-8">
            <span
              key={displayNum}
              className="text-7xl sm:text-8xl font-black font-mono text-white tracking-tight animate-in zoom-in-50 duration-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]"
            >
              {displayNum > 0 ? displayNum : 'GO!'}
            </span>
          </div>

          {/* Player standing & points */}
          <div className="px-5 py-2.5 rounded-2xl bg-black/30 backdrop-blur-md border border-white/20 flex items-center gap-3">
            <span className="text-xs text-white/80 font-medium">Player: <strong>{studentName}</strong></span>
            <span className="text-white/40">·</span>
            <span className="text-xs font-mono font-bold text-amber-200">
              Score: {totalScore} pts
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 5. SUBMITTED / ALREADY VOTED STATE FOR CURRENT QUESTION
  // "and the points add up to his score as question changes and next question can only be changed by host only"
  if (submittedSuccess || alreadyVoted) {
    const userMarkedId = markedOptionId || (poll.options?.find((o) => o.option_text === voteSummary)?.id);
    const isAnswerCorrect = wasCorrect ?? false;

    // Retrieve user's selected choice text and option letter
    const userOptionIndex = poll.options?.findIndex(
      (o) => o.id === userMarkedId || o.option_text === voteSummary
    ) ?? -1;
    const markedOptionText =
      userOptionIndex >= 0
        ? poll.options![userOptionIndex].option_text
        : voteSummary || 'Your Selection';

    const isLastQuestion = currentQIndex >= totalQuestionsCount - 1;

    return (
      <div className="min-h-screen bg-[#F4F6FB] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="clay-card p-6 sm:p-8 max-w-lg w-full text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
          {poll.type === 'quiz' ? (
            /* Quiz Result & Correct / Incorrect Verdict */
            <div className="w-full flex flex-col items-center">
              {/* Question progress badge */}
              <div className="flex items-center justify-between w-full pb-4 mb-4 border-b border-slate-100 text-xs font-semibold text-slate-500">
                <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full font-bold">
                  Question {currentQIndex + 1} of {totalQuestionsCount}
                </span>
                <span className="font-mono text-amber-800 font-bold">
                  Player: {studentName}
                </span>
              </div>

              {/* Verdict Header Icon */}
              {isAnswerCorrect ? (
                /* CORRECT FEEDBACK */
                <>
                  <div className="w-20 h-20 rounded-3xl bg-emerald-100 text-emerald-600 border-2 border-emerald-300 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/20">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2">
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Correct Choice!</span>
                  </div>

                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                    +{awardedPoints ?? 500} Points!
                  </h1>

                  <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5">
                    Fast reflexes! You earned speed bonus points for this question.
                  </p>
                </>
              ) : (
                /* INCORRECT FEEDBACK */
                <>
                  <div className="w-20 h-20 rounded-3xl bg-rose-100 text-rose-600 border-2 border-rose-300 flex items-center justify-center mb-4 shadow-xl shadow-rose-500/20">
                    <XCircle className="w-12 h-12" />
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-xs font-black uppercase tracking-wider mb-2">
                    <XCircle className="w-4 h-4" />
                    <span>Incorrect Choice</span>
                  </div>

                  <h1 className="text-3xl font-black text-rose-600 tracking-tight">
                    0 Points
                  </h1>

                  <p className="text-xs sm:text-sm text-slate-500 mt-1 mb-5">
                    Your marked choice was incorrect. Better luck on the next question!
                  </p>
                </>
              )}

              {/* Points Add Up Section (Cumulative Total Score) */}
              <div className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white mb-5 shadow-lg shadow-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 fill-white text-white" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] uppercase font-extrabold text-amber-100 tracking-wider block">
                      Cumulative Score
                    </span>
                    <span className="text-xs text-white/90">Points added across questions</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black font-mono tracking-tight">
                    {totalScore}
                  </span>
                  <span className="text-xs font-bold text-amber-100 ml-1">pts</span>
                </div>
              </div>

              {/* Question & Marked Choice Review (Answer is NOT visible) */}
              <div className="w-full text-left bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 mb-5 flex flex-col gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Question #{currentQIndex + 1}
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                    {poll.question}
                  </p>
                </div>

                <div className="border-t border-slate-200/60 pt-3 flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                    Your Marked Choice
                  </span>

                  <div
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                      isAnswerCorrect
                        ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                        : 'bg-rose-50 border-2 border-rose-500 text-rose-950 font-bold shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                          isAnswerCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {userOptionIndex >= 0 ? String.fromCharCode(65 + userOptionIndex) : '•'}
                      </span>
                      <span className="text-xs sm:text-sm truncate">
                        {markedOptionText}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md flex items-center gap-1 shrink-0 ${
                        isAnswerCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {isAnswerCorrect ? (
                        <>
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Correct</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          <span>Incorrect</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Secrecy notice: The correct answer is not shown */}
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 bg-white/80 py-2 px-3 rounded-lg border border-slate-200/60 mt-1">
                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>The correct answer is not shown to maintain quiz secrecy</span>
                  </div>
                </div>
              </div>

              {/* Waiting for Host to change question */}
              <div className="w-full p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  <span className="font-bold text-amber-950">
                    {isLastQuestion
                      ? 'Waiting for host to reveal final podium...'
                      : `Waiting for host to advance to Question ${currentQIndex + 2}...`}
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                  Host-Controlled
                </span>
              </div>
            </div>
          ) : (
            /* Normal Poll Result Box */
            <>
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 border border-emerald-100 shadow-md shadow-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <span className="text-xs font-bold text-emerald-700 tracking-wider uppercase bg-emerald-50 px-3 py-1 rounded-full mb-3">
                Vote Recorded
              </span>

              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Response submitted successfully!
              </h1>

              <p className="text-sm text-slate-500 mt-2 mb-6">
                Thank you for participating. Look at the presentation screen to see the live results!
              </p>

              {voteSummary && (
                <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mb-6 flex flex-col items-center">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Your Answer
                  </span>
                  <span className="text-base font-bold text-indigo-600 mt-1">
                    {voteSummary}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="w-full pt-4 mt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Campus Vote</span>
            <span>Real-time Live Sync</span>
          </div>
        </div>
      </div>
    );
  }

  // Poll Closed State for standard polls
  if (poll.status === 'closed') {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex flex-col items-center justify-center p-4">
        <div className="clay-card p-8 max-w-sm w-full text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 border border-rose-100">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">
            This poll has ended.
          </h2>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            The host has closed voting for this question. No additional responses can be submitted.
          </p>
          <Link
            to={`/poll/${poll.id}/results`}
            className="w-full py-3 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
          >
            View Final Results
          </Link>
        </div>
      </div>
    );
  }

  // Poll Draft State (Waiting for host)
  if (poll.status === 'draft') {
    return (
      <div className="min-h-screen bg-[#F4F6FB] flex flex-col items-center justify-center p-4">
        <div className="clay-card p-8 max-w-sm w-full text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-100 animate-pulse">
            <Clock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">
            Poll hasn't started yet
          </h2>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Waiting for the host to start this {poll.type === 'quiz' ? 'speed quiz' : 'question'}. This page will update automatically!
          </p>
          <div className="flex items-center gap-2 text-xs font-mono text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
            <span>Standing by...</span>
          </div>
        </div>
      </div>
    );
  }

  // 6. ACTIVE QUESTION VOTING INTERFACE (Flashed after the 3-second timer!)
  return (
    <div className="min-h-screen bg-[#F4F6FB] py-6 px-4 sm:px-6 flex flex-col justify-center items-center">
      <div className="w-full max-w-md">
        {/* Header / Brand */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold text-indigo-600 tracking-wider uppercase mb-1">
            {poll.type === 'quiz' ? (
              <span className="flex items-center gap-1.5 text-amber-600">
                <Zap className="w-4 h-4 fill-amber-500" />
                <span>Question {currentQIndex + 1} of {totalQuestionsCount}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Vote className="w-4 h-4" />
                <span>Campus Vote</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Room Code: {poll.join_code}
          </p>
        </div>

        {/* Voting Card */}
        <div className="clay-card p-6 sm:p-8 relative overflow-hidden animate-in fade-in duration-200">
          {/* Quiz Top Status & Score Bar */}
          {poll.type === 'quiz' && (
            <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-950">
                  Player: <span className="text-indigo-600 font-bold">{studentName}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Total Score Badge */}
                <div className="flex items-center gap-1 text-xs font-mono font-black text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300">
                  <Trophy className="w-3 h-3 text-amber-600" />
                  <span>{totalScore} pts</span>
                </div>
                {/* Time Remaining Indicator */}
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-rose-700 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                  <Timer className="w-3.5 h-3.5 text-rose-600 animate-spin" />
                  <span>{Math.max(0, (poll.time_limit_seconds || 30) - elapsedSeconds)}s</span>
                </div>
              </div>
            </div>
          )}

          {/* Poll Title & Question */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              <span>{poll.title}</span>
              {poll.type === 'quiz' && (
                <span className="text-amber-700 font-bold font-mono">
                  Q{currentQIndex + 1}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
              {poll.question}
            </h1>
          </div>

          {/* Weak network / Offline / Retrying status banner */}
          {(!isOnline || retryStatusText) && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2.5 animate-pulse">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex flex-col text-left">
                <span>{retryStatusText || 'Connection interrupted — answer preserved locally.'}</span>
                <span className="text-[10px] text-amber-700 font-normal">
                  {retryStatusText
                    ? 'Retrying vote with server. Please keep this screen open.'
                    : 'Your selection is saved. It will submit automatically when connectivity returns.'}
                </span>
              </div>
            </div>
          )}

          {/* Validation / Submission Error */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* 1. QUIZ MODE Options */}
            {poll.type === 'quiz' && (
              <div className="flex flex-col gap-3">
                {poll.options?.map((opt, index) => {
                  const isSelected = selectedOptionId === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(opt.id)}
                      className={`w-full p-4 rounded-2xl flex items-center justify-between text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'border-2 border-amber-500 bg-amber-50/80 shadow-md shadow-amber-500/15 scale-[1.01]'
                          : 'clay-choice-card hover:border-amber-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-extrabold text-xs ${
                            isSelected
                              ? 'bg-amber-500 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span
                          className={`text-sm sm:text-base font-semibold ${
                            isSelected ? 'text-amber-950 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {opt.option_text}
                        </span>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 2. YES / NO Question Controls */}
            {poll.type === 'yes_no' && (
              <div className="grid grid-cols-2 gap-4">
                {(() => {
                  const yesOpt = poll.options?.find((o) => o.option_text.toLowerCase() === 'yes') || poll.options?.[0];
                  const isSelected = selectedOptionId === yesOpt?.id;

                  return (
                    <button
                      key="btn-yes"
                      type="button"
                      onClick={() => {
                        if (yesOpt) handleSelectOption(yesOpt.id);
                      }}
                      className={`p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)] scale-[1.02]'
                          : 'clay-btn-secondary hover:border-emerald-300 text-slate-800'
                      }`}
                    >
                      <ThumbsUp className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-emerald-600'}`} />
                      <span className="text-xl font-extrabold tracking-wider">YES</span>
                    </button>
                  );
                })()}

                {(() => {
                  const noOpt = poll.options?.find((o) => o.option_text.toLowerCase() === 'no') || poll.options?.[1];
                  const isSelected = selectedOptionId === noOpt?.id;

                  return (
                    <button
                      key="btn-no"
                      type="button"
                      onClick={() => {
                        if (noOpt) handleSelectOption(noOpt.id);
                      }}
                      className={`p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-rose-600 text-white shadow-[0_8px_24px_rgba(244,63,94,0.35)] scale-[1.02]'
                          : 'clay-btn-secondary hover:border-rose-300 text-slate-800'
                      }`}
                    >
                      <ThumbsDown className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-rose-600'}`} />
                      <span className="text-xl font-extrabold tracking-wider">NO</span>
                    </button>
                  );
                })()}
              </div>
            )}

            {/* 3. Multiple Choice Options */}
            {poll.type === 'multiple_choice' && (
              <div className="flex flex-col gap-3">
                {poll.options?.map((opt, index) => {
                  const isSelected = selectedOptionId === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectOption(opt.id)}
                      className={`w-full p-4 rounded-2xl flex items-center justify-between text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'clay-choice-card-selected'
                          : 'clay-choice-card'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span
                          className={`text-sm sm:text-base font-semibold ${
                            isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {opt.option_text}
                        </span>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-600'
                            : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 4. Rating System (1–5 Stars) */}
            {poll.type === 'rating' && (
              <div className="flex flex-col items-center gap-5 py-4">
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const isSelected = selectedRating === starVal;
                    const isFilled = (selectedRating ?? 0) >= starVal;

                    return (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => handleSelectRating(starVal)}
                        className={`p-3 sm:p-4 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                            : 'clay-btn-secondary hover:border-amber-300'
                        }`}
                      >
                        <Star
                          className={`w-7 h-7 sm:w-8 sm:h-8 ${
                            isFilled
                              ? isSelected
                                ? 'fill-white text-white'
                                : 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                        <span className="font-mono text-xs font-bold">{starVal}</span>
                      </button>
                    );
                  })}
                </div>

                <span className="text-xs font-medium text-slate-500">
                  {selectedRating
                    ? `Selected: ${selectedRating} of 5 Stars`
                    : 'Tap a star to rate'}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-4 text-base font-bold text-white rounded-2xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 cursor-pointer ${
                  poll.type === 'quiz'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25'
                    : 'clay-btn-primary'
                }`}
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{retryStatusText || 'Submitting Vote...'}</span>
                  </>
                ) : poll.type === 'quiz' ? (
                  <>
                    <Zap className="w-5 h-5 fill-white" />
                    <span>
                      {selectedOptionId
                        ? `Lock in Choice (${poll.options?.find((o) => o.id === selectedOptionId)?.option_text})`
                        : 'Tap a Choice to Answer!'}
                    </span>
                  </>
                ) : (
                  <span>Submit Response</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Small Privacy Note */}
        <p className="text-center text-[11px] text-slate-400 mt-4">
          Speed scoring: Fast answers get up to 1,000 points · Real-time live sync
        </p>
      </div>
    </div>
  );
};
