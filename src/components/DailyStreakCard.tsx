import React from 'react';
import { Flame, Check, Sparkles, Trophy, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { StreakData } from '../lib/streak';

interface DailyStreakCardProps {
  streakData: StreakData;
  onQuickPractice?: () => void;
}

export default function DailyStreakCard({ streakData, onQuickPractice }: DailyStreakCardProps) {
  const {
    currentStreak,
    longestStreak,
    hasPracticedToday,
    weekDays,
    nextMilestone,
    progressToMilestone,
  } = streakData;

  const isZero = currentStreak === 0;

  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white dark:border-gray-800 relative overflow-hidden transition-all hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)]">
      {/* Decorative ambient flame glow */}
      <div className={`absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
        hasPracticedToday 
          ? 'bg-orange-500/15 dark:bg-orange-500/20' 
          : 'bg-amber-500/10 dark:bg-amber-500/10'
      }`} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        {/* Left column: Flame badge & streak count */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            {/* Pulsing ring around flame when active */}
            <motion.div
              className={`absolute inset-0 rounded-2xl ${
                currentStreak > 0
                  ? 'bg-gradient-to-tr from-orange-500 to-amber-400 blur-sm opacity-60'
                  : 'bg-gray-400/20'
              }`}
              animate={currentStreak > 0 ? { scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] } : {}}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            />
            
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center relative shadow-lg ${
              currentStreak > 0
                ? 'bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 text-white shadow-orange-500/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
            }`}>
              <motion.div
                animate={currentStreak > 0 ? { rotate: [-3, 3, -3], scale: [1, 1.05, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              >
                <Flame className={`w-8 h-8 sm:w-9 sm:h-9 ${currentStreak > 0 ? 'fill-amber-200 stroke-white' : ''}`} />
              </motion.div>
            </div>

            {hasPracticedToday && (
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                <Check className="w-3 h-3 stroke-[3]" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Daily Streak
              </span>
              {hasPracticedToday && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Active Today
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                {currentStreak}
              </span>
              <span className="text-base sm:text-lg font-bold text-gray-500 dark:text-gray-400">
                {currentStreak === 1 ? 'day' : 'days'}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
              {hasPracticedToday
                ? "You're on fire! Practice completed today."
                : isZero
                ? 'Practice a paper today to ignite your streak!'
                : 'Practice today to keep your streak burning!'}
            </p>
          </div>
        </div>

        {/* Middle column: 7-day progress timeline */}
        <div className="flex-1 max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Last 7 Days</span>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-500" />
              Best: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
            </span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {weekDays.map((day, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                  day.isToday ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-gray-400 dark:text-gray-500'
                }`}>
                  {day.dayName}
                </span>

                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all relative ${
                  day.practiced
                    ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-orange-500/25 scale-100'
                    : day.isToday
                    ? 'border-2 border-dashed border-orange-400 dark:border-orange-500/80 bg-orange-50/50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 animate-pulse'
                    : 'bg-gray-100/70 dark:bg-gray-800/60 text-gray-400 dark:text-gray-600'
                }`}>
                  {day.practiced ? (
                    <Flame className="w-5 h-5 fill-amber-200 stroke-white" />
                  ) : day.isToday ? (
                    <span className="text-xs font-black">+</span>
                  ) : (
                    <span className="text-[11px] font-medium">{day.dayNumber}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Milestone progress bar */}
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span className="text-gray-600 dark:text-gray-300">
                {currentStreak >= nextMilestone ? 'Milestone Reached!' : `Goal: ${nextMilestone}-Day Streak`}
              </span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {currentStreak}/{nextMilestone} days
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressToMilestone}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Right column: Action */}
        {!hasPracticedToday && onQuickPractice && (
          <div className="shrink-0 flex items-center">
            <button
              onClick={onQuickPractice}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white font-semibold text-sm shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              <span>Practice Today</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
