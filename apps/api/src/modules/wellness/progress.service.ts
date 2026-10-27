import type {
  ActivitySession,
  WellnessGoal,
  GoalProgress,
  Reminder,
  WellnessNotification,
} from '@screenwise/shared';
export function localDate(at: Date | string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(at));
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
function monday(date: string) {
  const day = new Date(date + 'T12:00:00Z').getUTCDay();
  return addDays(date, -((day + 6) % 7));
}
export function goalProgress(
  goal: WellnessGoal,
  sessions: ActivitySession[],
  now = new Date(),
): GoalProgress {
  const today = localDate(now, goal.timezone);
  const start =
    goal.tracking_start > goal.start_date
      ? goal.tracking_start
      : goal.start_date;
  const archivedAt =
    goal.status === 'ARCHIVED' ? (goal.archived_at ?? goal.updated_at) : null;
  const end = [
    today,
    goal.end_date,
    archivedAt && localDate(archivedAt, goal.timezone),
  ]
    .filter((d): d is string => !!d)
    .sort()[0]!;
  const counts = new Map<string, number>();
  for (const s of sessions)
    if (
      s.status === 'COMPLETED' &&
      s.completed_at &&
      (!archivedAt || Date.parse(s.completed_at) <= Date.parse(archivedAt)) &&
      goal.activity_ids.includes(s.activity_id)
    ) {
      const date = localDate(s.completed_at, goal.timezone);
      if (date >= start && date <= end)
        counts.set(date, (counts.get(date) ?? 0) + 1);
    }
  return goalProgressFromCounts(goal, Object.fromEntries(counts), now);
}
/** Database-aggregated daily counts use exactly the same Phase 4 period/streak rules. */
export function goalProgressFromCounts(
  goal: WellnessGoal,
  dailyCounts: Record<string, number>,
  now = new Date(),
): GoalProgress {
  const today = localDate(now, goal.timezone);
  const start =
    goal.tracking_start > goal.start_date
      ? goal.tracking_start
      : goal.start_date;
  const archivedAt =
    goal.status === 'ARCHIVED' ? (goal.archived_at ?? goal.updated_at) : null;
  const end = [
    today,
    goal.end_date,
    archivedAt && localDate(archivedAt, goal.timezone),
  ]
    .filter((d): d is string => !!d)
    .sort()[0]!;
  const counts = new Map(Object.entries(dailyCounts));
  const history: GoalProgress['history'] = [];
  let date = goal.period === 'WEEKLY' ? monday(start) : start;
  let longest = 0,
    run = 0;
  const currentStart = goal.period === 'WEEKLY' ? monday(today) : today;
  for (let i = 0; date <= end && i < 40000; i++) {
    const stop = goal.period === 'WEEKLY' ? addDays(date, 6) : date;
    let count = 0,
      paused = false;
    for (let d = date; d <= stop; d = addDays(d, 1)) {
      if (d < start || d > end) continue;
      const skip = goal.pause_ranges.some(
        (p) => d >= p.from && (!p.to || d <= p.to),
      );
      if (skip) paused = true;
      else count += counts.get(d) ?? 0;
    }
    const met = count >= goal.target_count && !paused;
    history.push({ date, count, target: goal.target_count, met, paused });
    if (paused) run = 0;
    else if (met) {
      run++;
      longest = Math.max(longest, run);
    } else if (date < currentStart) run = 0;
    date = addDays(date, goal.period === 'WEEKLY' ? 7 : 1);
  }
  const current = history.find((h) => h.date === currentStart);
  const last = history.at(-1);
  let streak = 0;
  const previous = history.filter(
    (h) => h.date < currentStart || (h.date === currentStart && h.met),
  );
  for (const h of previous.reverse()) {
    if (!h.met) break;
    streak++;
  }
  // A missed finished period breaks the streak; an unfinished current period has until its end.
  if (last && last.date < currentStart && !last.met) streak = 0;
  return {
    count: current?.count ?? 0,
    target: goal.target_count,
    percentage: Math.min(
      100,
      Math.round(((current?.count ?? 0) / goal.target_count) * 100),
    ),
    periodStart: currentStart,
    periodEnd:
      goal.period === 'WEEKLY' ? addDays(currentStart, 6) : currentStart,
    currentStreak:
      goal.status !== 'ACTIVE' ||
      (goal.end_date !== null && goal.end_date < today) ||
      current?.paused
        ? 0
        : streak,
    longestStreak: longest,
    streakUnit: goal.period === 'WEEKLY' ? 'weeks' : 'days',
    history,
  };
}
export function dueReminder(
  reminder: Reminder,
  now = new Date(),
): {
  key: string;
  title: string;
  message: string;
  type: WellnessNotification['type'];
  reminder_id: string;
} | null {
  if (!reminder.enabled) return null;
  const timezone = reminder.timezone;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const minute =
    Number(parts.find((p) => p.type === 'hour')!.value) * 60 +
    Number(parts.find((p) => p.type === 'minute')!.value);
  const date = localDate(now, timezone);
  const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
  if (!reminder.days_of_week.includes(weekday)) return null;
  const minutes = (s: string) =>
    Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const start = minutes(reminder.start_time),
    end = minutes(reminder.end_time);
  if (minute < start || minute >= end) return null;
  const slot =
    reminder.reminder_type === 'EVENING_ROUTINE'
      ? 0
      : Math.floor((minute - start) / reminder.interval_minutes!);
  const labels = {
    EYE_BREAK: [
      'Time for a visual pause',
      'Consider a brief visual break from your screen.',
      'BREAK_REMINDER',
    ],
    POSTURE: [
      'Check your comfort',
      'Consider a comfortable change of position.',
      'ACTIVITY_REMINDER',
    ],
    MOVEMENT: [
      'Make room for movement',
      'Consider a short movement break if it feels comfortable.',
      'ACTIVITY_REMINDER',
    ],
    DAILY_GOAL: [
      'Your wellness goals',
      'Review your daily checklist and the goals you chose.',
      'GOAL_REMINDER',
    ],
    EVENING_ROUTINE: [
      'A moment to wind down',
      'Review your chosen evening routine when it suits you.',
      'ACTIVITY_REMINDER',
    ],
  } as const;
  const [title, message, type] = labels[reminder.reminder_type];
  return {
    key: reminder.id + ':' + date + ':' + slot,
    title,
    message,
    type,
    reminder_id: reminder.id,
  };
}
