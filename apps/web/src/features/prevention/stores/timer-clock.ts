export type TimerPhase = 'FOCUS' | 'FOCUS_READY' | 'BREAK' | 'CONFIRM';
export interface TimerClock {
  phase: TimerPhase;
  remaining: number;
  deadline: number | null;
  running: boolean;
}
export function advanceClock(clock: TimerClock, now: number): TimerClock {
  if (!clock.running || clock.deadline === null) return clock;
  const remaining = Math.max(0, clock.deadline - now);
  return {
    ...clock,
    remaining,
    running: remaining > 0,
    deadline: remaining > 0 ? clock.deadline : null,
    phase:
      remaining === 0
        ? clock.phase === 'FOCUS'
          ? 'FOCUS_READY'
          : 'CONFIRM'
        : clock.phase,
  };
}
export function restoreClock<T extends TimerClock>(clock: T): T {
  return {
    ...clock,
    remaining: Math.max(0, clock.remaining),
    deadline: null,
    running: false,
  };
}
