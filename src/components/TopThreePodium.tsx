import React from 'react';
import { Trophy, Medal, Crown, Sparkles } from 'lucide-react';
import { PodiumEntry } from '../types/poll';

interface TopThreePodiumProps {
  entries: PodiumEntry[];
  currentParticipantId?: string;
  currentParticipantName?: string;
  theme?: 'dark' | 'light';
  title?: string;
}

export const TopThreePodium: React.FC<TopThreePodiumProps> = ({
  entries,
  currentParticipantId,
  currentParticipantName,
  theme = 'light',
  title = 'Grand Champions Podium',
}) => {
  const isDark = theme === 'dark';

  const first = entries.find((e) => e.rank === 1);
  const second = entries.find((e) => e.rank === 2);
  const third = entries.find((e) => e.rank === 3);

  const isMe = (entry?: PodiumEntry) => {
    if (!entry) return false;
    if (currentParticipantId && entry.participantId === currentParticipantId) return true;
    if (currentParticipantName && entry.participantName.trim().toLowerCase() === currentParticipantName.trim().toLowerCase()) return true;
    return false;
  };

  return (
    <div
      className={`w-full p-5 sm:p-7 rounded-3xl transition-all ${
        isDark
          ? 'bg-gradient-to-b from-slate-900/90 via-slate-900/60 to-slate-950/80 border-2 border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.15)]'
          : 'clay-card bg-gradient-to-b from-amber-50/60 via-white to-orange-50/40 border border-amber-200'
      }`}
    >
      {/* Podium Header */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-6 border-b border-amber-500/20">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
            <Trophy className="w-5 h-5 fill-white" />
          </div>
          <div>
            <h3 className={`text-base sm:text-lg font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h3>
            <span className={`text-[11px] font-semibold ${isDark ? 'text-amber-400/90' : 'text-amber-800'}`}>
              Top 3 Tournament Winners
            </span>
          </div>
        </div>

        <span
          className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full flex items-center gap-1 ${
            isDark ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-amber-100 text-amber-900 border border-amber-200'
          }`}
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Top 3 Only</span>
        </span>
      </div>

      {/* 3-Step Visual Olympic Podium */}
      <div className="pt-8 pb-2 flex items-end justify-center gap-2 sm:gap-4 max-w-lg mx-auto">
        {/* 2nd Place Column (Left) */}
        <div className="flex-1 flex flex-col items-center">
          {second ? (
            <div className="flex flex-col items-center mb-2 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="relative mb-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-slate-300 to-slate-100 border-2 border-slate-300 flex items-center justify-center text-slate-700 shadow-md">
                  <Medal className="w-6 h-6 sm:w-7 sm:h-7 text-slate-600" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  2
                </span>
              </div>
              <span
                className={`text-xs sm:text-sm font-bold truncate max-w-[90px] sm:max-w-[120px] ${
                  isMe(second)
                    ? 'text-indigo-600 font-extrabold underline'
                    : isDark
                    ? 'text-slate-200'
                    : 'text-slate-900'
                }`}
                title={second.participantName}
              >
                {second.participantName} {isMe(second) && '(You)'}
              </span>
              <span className={`text-[11px] font-mono font-extrabold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {second.points} pts
              </span>
            </div>
          ) : (
            <div className="text-center mb-2">
              <div className="w-10 h-10 rounded-xl bg-slate-200/50 border border-dashed border-slate-400/50 flex items-center justify-center text-slate-400 text-xs font-bold mb-1">
                2
              </div>
              <span className="text-[10px] text-slate-400">—</span>
            </div>
          )}

          {/* Podium Pillar 2 */}
          <div
            className={`w-full h-28 sm:h-32 rounded-t-2xl flex flex-col items-center justify-start pt-3 border-t-2 border-x-2 transition-all ${
              isDark
                ? 'bg-gradient-to-b from-slate-700/80 via-slate-800/80 to-slate-900/90 border-slate-500/60 shadow-lg shadow-slate-950/50'
                : 'bg-gradient-to-b from-slate-200 via-slate-100 to-slate-200/70 border-slate-300 shadow-inner'
            }`}
          >
            <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              2nd
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Silver
            </span>
          </div>
        </div>

        {/* 1st Place Column (Center - Highest) */}
        <div className="flex-1 flex flex-col items-center">
          {first ? (
            <div className="flex flex-col items-center mb-2 text-center animate-in zoom-in-90 duration-300">
              <div className="relative mb-1">
                <Crown className="w-6 h-6 text-amber-400 fill-amber-400 animate-bounce mb-0.5" />
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-amber-500 border-2 border-amber-300 flex items-center justify-center text-amber-950 shadow-xl shadow-amber-500/30">
                  <Trophy className="w-7 h-7 sm:w-8 sm:h-8 fill-amber-950 text-amber-950" />
                </div>
                <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-mono font-black flex items-center justify-center shadow-md">
                  1
                </span>
              </div>
              <span
                className={`text-xs sm:text-sm font-extrabold truncate max-w-[100px] sm:max-w-[130px] ${
                  isMe(first)
                    ? 'text-amber-500 underline'
                    : isDark
                    ? 'text-amber-200'
                    : 'text-amber-950'
                }`}
                title={first.participantName}
              >
                {first.participantName} {isMe(first) && '(You)'}
              </span>
              <span className="text-xs font-mono font-black text-amber-400 drop-shadow-sm">
                {first.points} pts
              </span>
            </div>
          ) : (
            <div className="text-center mb-2">
              <div className="w-12 h-12 rounded-xl bg-amber-200/50 border border-dashed border-amber-400/50 flex items-center justify-center text-amber-600 text-sm font-bold mb-1">
                1
              </div>
              <span className="text-[10px] text-slate-400">—</span>
            </div>
          )}

          {/* Podium Pillar 1 */}
          <div
            className={`w-full h-36 sm:h-44 rounded-t-2xl flex flex-col items-center justify-start pt-3 border-t-2 border-x-2 transition-all ${
              isDark
                ? 'bg-gradient-to-b from-amber-500 via-amber-600 to-amber-950 border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)]'
                : 'bg-gradient-to-b from-amber-400 via-amber-300 to-amber-500/80 border-amber-400 shadow-md shadow-amber-500/20'
            }`}
          >
            <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-amber-950'}`}>
              1st
            </span>
            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-wider ${isDark ? 'text-amber-200' : 'text-amber-900'}`}>
              Champion
            </span>
          </div>
        </div>

        {/* 3rd Place Column (Right) */}
        <div className="flex-1 flex flex-col items-center">
          {third ? (
            <div className="flex flex-col items-center mb-2 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="relative mb-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-800 border-2 border-amber-600 flex items-center justify-center text-amber-100 shadow-md">
                  <Medal className="w-6 h-6 sm:w-7 sm:h-7 text-amber-200" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-900 text-white text-[10px] font-mono font-bold flex items-center justify-center">
                  3
                </span>
              </div>
              <span
                className={`text-xs sm:text-sm font-bold truncate max-w-[90px] sm:max-w-[120px] ${
                  isMe(third)
                    ? 'text-amber-700 font-extrabold underline'
                    : isDark
                    ? 'text-amber-200/90'
                    : 'text-slate-900'
                }`}
                title={third.participantName}
              >
                {third.participantName} {isMe(third) && '(You)'}
              </span>
              <span className={`text-[11px] font-mono font-extrabold ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                {third.points} pts
              </span>
            </div>
          ) : (
            <div className="text-center mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-900/10 border border-dashed border-amber-700/30 flex items-center justify-center text-amber-700 text-xs font-bold mb-1">
                3
              </div>
              <span className="text-[10px] text-slate-400">—</span>
            </div>
          )}

          {/* Podium Pillar 3 */}
          <div
            className={`w-full h-20 sm:h-24 rounded-t-2xl flex flex-col items-center justify-start pt-2 border-t-2 border-x-2 transition-all ${
              isDark
                ? 'bg-gradient-to-b from-amber-800/80 via-amber-900/80 to-slate-950 border-amber-700/60 shadow-lg shadow-black/40'
                : 'bg-gradient-to-b from-amber-200/80 via-orange-100 to-amber-200/50 border-amber-300 shadow-inner'
            }`}
          >
            <span className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>
              3rd
            </span>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-amber-400/80' : 'text-amber-800'}`}>
              Bronze
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
