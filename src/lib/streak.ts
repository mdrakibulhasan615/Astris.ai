/**
 * Streak calculation and tracking utilities for Astris.ai
 */

export interface WeekDayStatus {
  dayName: string; // e.g. "Mon"
  dayNumber: number; // e.g. 19
  dateStr: string; // e.g. "2026-11-09"
  isToday: boolean;
  practiced: boolean;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  hasPracticedToday: boolean;
  lastPracticeDate: string | null;
  practiceDates: string[];
  weekDays: WeekDayStatus[];
  nextMilestone: number;
  progressToMilestone: number;
}

// Format Date object to local YYYY-MM-DD
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateStreak(rawDates: (string | Date | number)[]): StreakData {
  const today = new Date();
  const todayKey = formatDateKey(today);
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  // Parse and deduplicate date keys
  const dateSet = new Set<string>();
  rawDates.forEach(d => {
    try {
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) {
        dateSet.add(formatDateKey(parsed));
      }
    } catch {
      // ignore invalid dates
    }
  });

  const sortedDates = Array.from(dateSet).sort().reverse();
  const hasPracticedToday = dateSet.has(todayKey);
  const lastPracticeDate = sortedDates[0] || null;

  // Calculate consecutive days
  let currentStreak = 0;
  let checkDate = new Date();

  // If didn't practice today, check if practiced yesterday to keep streak alive
  if (!hasPracticedToday) {
    if (dateSet.has(yesterdayKey)) {
      checkDate = yesterday;
    } else {
      // Streak broken
      checkDate = today;
    }
  }

  // Count backwards from checkDate
  const testDate = new Date(checkDate);
  while (true) {
    const key = formatDateKey(testDate);
    if (dateSet.has(key)) {
      currentStreak++;
      testDate.setDate(testDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak across all history
  let longestStreak = currentStreak;
  if (sortedDates.length > 0) {
    const ascending = Array.from(dateSet).sort();
    let tempStreak = 0;
    let prevTime: number | null = null;

    ascending.forEach(dateStr => {
      const parts = dateStr.split('-').map(Number);
      const currentTime = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      
      if (prevTime === null) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((currentTime - prevTime) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      prevTime = currentTime;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    });
  }

  // Build the 7-day indicator (Past 7 days up to today)
  const weekDays: WeekDayStatus[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDateKey(d);
    weekDays.push({
      dayName: dayNames[d.getDay()],
      dayNumber: d.getDate(),
      dateStr,
      isToday: dateStr === todayKey,
      practiced: dateSet.has(dateStr),
    });
  }

  // Milestones: 3, 7, 14, 30, 50, 100 days
  const milestones = [3, 7, 14, 30, 50, 100];
  const nextMilestone = milestones.find(m => m > currentStreak) || (currentStreak + 10);
  const prevMilestone = [...milestones].reverse().find(m => m <= currentStreak) || 0;
  
  const span = nextMilestone - prevMilestone;
  const progressInSpan = currentStreak - prevMilestone;
  const progressToMilestone = Math.min(100, Math.max(0, Math.round((progressInSpan / span) * 100)));

  return {
    currentStreak,
    longestStreak,
    hasPracticedToday,
    lastPracticeDate,
    practiceDates: sortedDates,
    weekDays,
    nextMilestone,
    progressToMilestone,
  };
}
