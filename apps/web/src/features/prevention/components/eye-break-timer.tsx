import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth-provider';
import { useTimerStore } from '../stores/timer-store';
import { wellnessApi } from '../services/wellness-api';
import { useWellnessMutation } from '../hooks/use-wellness';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/errors';
export function EyeBreakTimer({ activityId }: { activityId?: string }) {
  const { user } = useAuth();
  const timer = useTimerStore();
  const [busy, setBusy] = useState(false);
  const finish = useWellnessMutation((id: string) =>
    wellnessApi.finish(id, 'COMPLETED'),
  );
  const beginBreak = async () => {
    if (!activityId || !user) return;
    setBusy(true);
    try {
      const session = await wellnessApi.start(
        activityId,
        crypto.randomUUID(),
        'TIMER',
      );
      if (session.status !== 'STARTED') {
        toast.error('This break session has ended. Reset to start again.');
        return;
      }
      timer.startBreak(user.id, activityId, session.id);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      if (timer.sessionId && timer.phase !== 'FOCUS')
        await wellnessApi.finish(timer.sessionId, 'CANCELLED');
      timer.reset();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const seconds = Math.ceil(timer.remaining / 1000);
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="space-y-5 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            A moment away from the screen
          </p>
          <h2 className="mt-2 text-2xl font-semibold">20–20–20 visual break</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            About every 20 minutes, consider looking at something about 20 feet
            away for 20 seconds. This is a wellness reminder, not a treatment.
          </p>
        </div>
        <p
          role="timer"
          aria-label="Eye break countdown"
          className="text-5xl font-semibold tabular-nums"
        >
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </p>
        <p className="text-sm">
          {timer.phase === 'FOCUS'
            ? 'Focus interval — a time reminder, not measured screen usage.'
            : timer.phase === 'FOCUS_READY'
              ? 'Ready for a short visual break?'
              : timer.phase === 'BREAK'
                ? 'Look away toward a comfortable distant point.'
                : 'Break timer finished. Confirm only if you took the break.'}
        </p>
        <div className="flex flex-wrap gap-3">
          {timer.phase === 'FOCUS' &&
          !timer.running &&
          timer.remaining === timer.intervalMinutes * 60000 ? (
            <Button disabled={busy} onClick={() => timer.startFocus(user!.id)}>
              Start focus timer
            </Button>
          ) : timer.running ? (
            <Button onClick={timer.pause}>Pause</Button>
          ) : timer.remaining > 0 ? (
            <Button onClick={timer.resume}>Resume</Button>
          ) : null}
          {timer.phase === 'FOCUS_READY' && (
            <Button
              disabled={!activityId || busy}
              onClick={() => void beginBreak()}
            >
              {busy ? 'Starting...' : 'Start 20-second break'}
            </Button>
          )}
          {timer.phase === 'CONFIRM' && (
            <Button
              disabled={finish.isPending || busy}
              onClick={async () => {
                if (!timer.sessionId) return;
                try {
                  await finish.mutateAsync(timer.sessionId);
                  toast.success('Visual break saved');
                  timer.reset();
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              {finish.isPending ? 'Saving...' : 'I took this break — save'}
            </Button>
          )}
          <Button
            variant="outline"
            disabled={busy || finish.isPending}
            onClick={() => void reset()}
          >
            Reset / cancel
          </Button>
        </div>
        <label className="block max-w-xs space-y-2 text-sm">
          Focus interval (5–120 minutes)
          <Input
            type="number"
            min="5"
            max="120"
            disabled={timer.running || !!timer.sessionId}
            value={timer.intervalMinutes}
            onChange={(e) => timer.setInterval(e.target.valueAsNumber)}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Navigation keeps the timer running. Refresh restores it paused.
          Closing the tab is not counted as screen activity. Break completion
          always needs confirmation.
        </p>
        {!activityId && (
          <p className="text-sm text-muted-foreground">
            Apply the Phase 4 activity seed to enable saving visual breaks.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
