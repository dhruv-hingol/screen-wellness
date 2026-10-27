import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { z } from 'zod';
import { advanceClock, restoreClock, type TimerClock } from './timer-clock';
interface TimerStore extends TimerClock {
  ownerId: string | null;
  intervalMinutes: number;
  activityId: string | null;
  sessionId: string | null;
  tick: (now: number) => void;
  startFocus: (owner: string) => void;
  pause: () => void;
  resume: () => void;
  setInterval: (minutes: number) => void;
  startBreak: (owner: string, activityId: string, sessionId: string) => void;
  reset: () => void;
  clear: () => void;
}
const initial = {
  ownerId: null,
  intervalMinutes: 20,
  phase: 'FOCUS' as const,
  remaining: 1200000,
  deadline: null,
  running: false,
  activityId: null,
  sessionId: null,
};
const savedTimerSchema = z.object({
  ownerId: z.uuid().nullable(),
  intervalMinutes: z.number().int().min(5).max(120),
  phase: z.enum(['FOCUS', 'FOCUS_READY', 'BREAK', 'CONFIRM']),
  remaining: z.number().min(0).max(7200000),
  deadline: z.number().nonnegative().nullable(),
  running: z.boolean(),
  activityId: z.uuid().nullable(),
  sessionId: z.uuid().nullable(),
});
export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      ...initial,
      tick: (now) => {
        const s = get();
        if (s.running) set(advanceClock(s, now));
      },
      startFocus: (owner) => {
        const s = get();
        set({
          ownerId: owner,
          phase: 'FOCUS',
          remaining: s.intervalMinutes * 60000,
          deadline: Date.now() + s.intervalMinutes * 60000,
          running: true,
          activityId: null,
          sessionId: null,
        });
      },
      pause: () => {
        const s = advanceClock(get(), Date.now());
        set({ ...s, running: false, deadline: null });
      },
      resume: () => {
        const s = get();
        if (s.remaining > 0)
          set({ running: true, deadline: Date.now() + s.remaining });
      },
      setInterval: (minutes) => {
        if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) return;
        set({
          intervalMinutes: minutes,
          remaining: minutes * 60000,
          deadline: null,
          running: false,
          phase: 'FOCUS',
        });
      },
      startBreak: (owner, activityId, sessionId) =>
        set({
          ownerId: owner,
          activityId,
          sessionId,
          phase: 'BREAK',
          remaining: 20000,
          deadline: Date.now() + 20000,
          running: true,
        }),
      reset: () => {
        const s = get();
        set({
          phase: 'FOCUS',
          remaining: s.intervalMinutes * 60000,
          deadline: null,
          running: false,
          activityId: null,
          sessionId: null,
        });
      },
      clear: () => set(initial),
    }),
    {
      name: 'screenwise-eye-timer',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      merge: (persisted, current) => {
        const saved = savedTimerSchema.safeParse(persisted);
        return saved.success
          ? { ...current, ...restoreClock(saved.data) }
          : current;
      },
    },
  ),
);
