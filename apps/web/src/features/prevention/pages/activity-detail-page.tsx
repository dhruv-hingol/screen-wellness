import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { ActivitySession, Activity } from '@screenwise/shared';
import { toast } from 'sonner';
import { useWellnessQuery, useWellnessMutation } from '../hooks/use-wellness';
import { wellnessApi } from '../services/wellness-api';
import { activityIcons } from '../components/activity-card';
import { PageHeader } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
} from '@/features/assessments/components/assessment-elements';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { errorMessage } from '@/lib/errors';
export function ActivityDetailPage() {
  const { activityId = '' } = useParams();
  const query = useWellnessQuery(['activity', activityId], () =>
    wellnessApi.activity(activityId),
  );
  if (query.isPending) return <AssessmentLoading />;
  if (query.isError)
    return (
      <QueryError error={query.error} retry={() => void query.refetch()} />
    );
  return <ActivitySessionView key={activityId} activity={query.data} />;
}
function ActivitySessionView({ activity: a }: { activity: Activity }) {
  const [params] = useSearchParams();
  const [session, setSession] = useState<ActivitySession | null>(null);
  const [step, setStep] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [startKey, setStartKey] = useState(() => crypto.randomUUID());
  const start = useWellnessMutation(() =>
    wellnessApi.start(
      a.id,
      startKey,
      params.get('source') === 'CHECKLIST' ? 'CHECKLIST' : 'MANUAL',
    ),
  );
  const finish = useWellnessMutation((status: 'COMPLETED' | 'CANCELLED') =>
    wellnessApi.finish(session!.id, status),
  );
  const active = session?.status === 'STARTED';
  const Icon = activityIcons[a.category];
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  const elapsed = session
    ? Math.max(0, Math.floor((now - Date.parse(session.started_at)) / 1000))
    : 0;
  return (
    <>
      <PageHeader
        title={a.title}
        description={a.description}
        action={
          <Button asChild variant="outline">
            <Link to="/prevention">All activities</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="grid gap-8 p-6 sm:p-9 md:grid-cols-[180px_1fr]">
          <div className="flex flex-col items-center gap-5 rounded-2xl bg-secondary/50 p-8">
            <Icon size={90} strokeWidth={1.2} className="text-primary" />
            <p className="text-center text-sm">
              {a.category.replaceAll('_', ' ')}
              <br />
              {a.duration_seconds} seconds · {a.difficulty}
            </p>
            {active && (
              <p
                role="timer"
                aria-label="Session elapsed time"
                className="text-2xl tabular-nums"
              >
                {Math.floor(elapsed / 60)}:
                {String(elapsed % 60).padStart(2, '0')}
              </p>
            )}
          </div>
          <div className="space-y-5">
            <h2 className="text-xl font-semibold">
              {active
                ? 'Step ' + (step + 1) + ' of ' + a.instructions.length
                : 'Activity guide'}
            </h2>
            {active ? (
              <p className="min-h-20 text-lg leading-relaxed">
                {a.instructions[step]}
              </p>
            ) : (
              <ol className="list-inside list-decimal space-y-3">
                {a.instructions.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ol>
            )}
            {active && (
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={step === 0}
                  onClick={() => setStep((s) => s - 1)}
                >
                  Previous step
                </Button>
                <Button
                  disabled={step === a.instructions.length - 1}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Next step
                </Button>
              </div>
            )}
            <div className="rounded-xl bg-accent/40 p-4 text-sm leading-relaxed">
              <p className="font-semibold">Move within your comfort</p>
              <p className="mt-2">
                {a.safety_notes ??
                  'Stop if an activity causes pain or discomfort. These activities are general wellness education, not treatment.'}
              </p>
            </div>
            {a.benefits.length > 0 && (
              <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
                {a.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            {!active ? (
              <>
                <p role="status" className="text-sm">
                  {session?.status === 'COMPLETED'
                    ? 'Your completion is saved.'
                    : session?.status === 'CANCELLED'
                      ? 'Session cancelled.'
                      : ''}
                </p>
                <Button
                  disabled={start.isPending}
                  onClick={async () => {
                    try {
                      const s = await start.mutateAsync();
                      setSession(s);
                      setStep(0);
                      setNow(Date.now());
                      if (s.status === 'COMPLETED')
                        toast.info(
                          'This checklist activity is already completed today.',
                        );
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  {start.isPending
                    ? 'Starting...'
                    : session
                      ? 'Start another session'
                      : 'Start activity'}
                </Button>
              </>
            ) : (
              <div className="flex flex-wrap gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={
                        finish.isPending || step !== a.instructions.length - 1
                      }
                    >
                      Complete activity
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Save this completion?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Confirm that you completed the activity. The server
                        records the completion time; elapsed time is not a
                        measurement of exercise or sleep.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Back</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          try {
                            setSession(await finish.mutateAsync('COMPLETED'));
                            setStartKey(crypto.randomUUID());
                            toast.success('Activity completion saved');
                          } catch (e) {
                            toast.error(errorMessage(e));
                          }
                        }}
                      >
                        Confirm completion
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant="outline"
                  disabled={finish.isPending}
                  onClick={async () => {
                    try {
                      setSession(await finish.mutateAsync('CANCELLED'));
                      setStartKey(crypto.randomUUID());
                      toast.info('Session cancelled');
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  Cancel session
                </Button>
              </div>
            )}
            {params.get('recommendationId') && (
              <p className="text-sm text-muted-foreground">
                This session does not change your recommendation status. You can
                explicitly mark it completed on your{' '}
                <Link className="text-primary underline" to="/wellness-plan">
                  wellness plan
                </Link>
                .
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
