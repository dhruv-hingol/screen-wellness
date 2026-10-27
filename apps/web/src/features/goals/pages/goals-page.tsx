import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  goalInputSchema,
  activityCategories,
  goalLabels,
  type GoalInput,
  type WellnessGoal,
  type Activity,
} from '@screenwise/shared';
import {
  useWellnessQuery,
  useWellnessMutation,
} from '@/features/prevention/hooks/use-wellness';
import { wellnessApi } from '@/features/prevention/services/wellness-api';
import {
  PageHeader,
  EmptyState,
  StatCard,
} from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function GoalsPage() {
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<WellnessGoal | null | undefined>(
    undefined,
  );
  const [suggestion, setSuggestion] = useState('');
  const query = useWellnessQuery(['goals', status, page], () =>
    wellnessApi.goals({ status, page }),
  );
  const summary = useWellnessQuery(['goal-summary'], wellnessApi.summary);
  const activities = useWellnessQuery(['all-activities'], () =>
    wellnessApi.activities({ pageSize: 100 }),
  );
  return (
    <>
      <PageHeader
        title="Small steps, meaningful goals"
        description="Track confirmed activity completions against goals you choose."
        action={
          <Button
            onClick={() => {
              setSuggestion('');
              setEditing(null);
            }}
          >
            Create goal
          </Button>
        }
      />
      {summary.isError ? (
        <QueryError
          error={summary.error}
          retry={() => void summary.refetch()}
        />
      ) : summary.isPending ? (
        <AssessmentLoading />
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Active goals"
            value={
              summary.data.goals.filter((g) => g.status === 'ACTIVE').length
            }
            description="Measurable goals you chose"
          />
          <StatCard
            label="Targets met this period"
            value={
              summary.data.goals.filter(
                (g) =>
                  g.status === 'ACTIVE' && (g.progress?.percentage ?? 0) >= 100,
              ).length
            }
            description="Based on confirmed activity sessions"
          />
          <StatCard
            label="Best active daily streak"
            value={Math.max(
              0,
              ...summary.data.goals
                .filter((g) => g.status === 'ACTIVE' && g.period === 'DAILY')
                .map((g) => g.progress?.currentStreak ?? 0),
            )}
            description="Consecutive days meeting a daily target"
          />
        </div>
      )}
      {!!summary.data?.interests.length && (
        <div className="mb-6 rounded-xl border bg-secondary/30 p-5">
          <p className="mb-3 text-sm">
            Your onboarding interests can inspire a goal. Nothing is activated
            until you save it.
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.data.interests.map((key) => (
              <Button
                key={key}
                variant="outline"
                onClick={() => {
                  setSuggestion(key);
                  setEditing(null);
                }}
              >
                {goalLabels[key as keyof typeof goalLabels] ?? key}
              </Button>
            ))}
          </div>
        </div>
      )}
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit goal' : 'Create a measurable goal'}
            </DialogTitle>
            <DialogDescription>
              Saved completions count toward linked activities. Changing
              measurement settings starts a new tracking period; the previous
              definition is retained.
            </DialogDescription>
          </DialogHeader>
          {activities.isPending ? (
            <AssessmentLoading />
          ) : activities.isError ? (
            <QueryError
              error={activities.error}
              retry={() => void activities.refetch()}
            />
          ) : (
            <GoalForm
              key={editing?.id ?? suggestion ?? 'new'}
              goal={editing ?? undefined}
              suggestion={suggestion}
              activities={activities.data.data}
              done={() => setEditing(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
      <div className="mb-5 flex flex-wrap gap-3">
        {['ACTIVE', 'PAUSED', 'ARCHIVED'].map((s) => (
          <Button
            key={s}
            variant={status === s ? 'default' : 'outline'}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s}
          </Button>
        ))}
      </div>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            {query.data.data.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                edit={() => setEditing(g)}
                activities={activities.data?.data ?? []}
              />
            ))}
          </div>
          <Pagination
            page={page}
            pages={query.data.meta.totalPages}
            onChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          title={'No ' + status.toLowerCase() + ' goals'}
          description="Create a goal with a daily or weekly target and at least one associated activity."
        />
      )}
    </>
  );
}
function GoalForm({
  goal,
  suggestion,
  activities,
  done,
}: {
  goal?: WellnessGoal;
  suggestion: string;
  activities: Activity[];
  done: () => void;
}) {
  const category =
    (
      {
        eye_comfort: 'EYE_COMFORT',
        posture: 'POSTURE',
        sleep: 'SLEEP',
        screen_breaks: 'DIGITAL_BREAK',
        digital_fatigue: 'DIGITAL_BREAK',
        overall_wellness: 'GENERAL',
      } as const
    )[suggestion as 'eye_comfort'] ?? 'MOVEMENT';
  const form = useForm<GoalInput>({
    resolver: zodResolver(goalInputSchema),
    defaultValues: goal
      ? {
          title: goal.title,
          description: goal.description,
          category: goal.category,
          target_count: goal.target_count,
          period: goal.period,
          start_date: goal.start_date,
          end_date: goal.end_date,
          timezone: goal.timezone,
          activity_ids: goal.activity_ids,
        }
      : {
          title: suggestion
            ? 'My ' +
              (goalLabels[suggestion as keyof typeof goalLabels] ??
                'wellness') +
              ' goal'
            : '',
          description: null,
          category,
          target_count: 1,
          period: 'DAILY',
          start_date: new Date().toLocaleDateString('en-CA'),
          end_date: null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          activity_ids: [],
        },
  });
  const selected = useWatch({ control: form.control, name: 'activity_ids' });
  const chosenCategory = useWatch({ control: form.control, name: 'category' });
  const eligibleActivities = activities.filter(
    (activity) =>
      chosenCategory === 'GENERAL' || activity.category === chosenCategory,
  );
  const save = useWellnessMutation((body: GoalInput) =>
    wellnessApi.saveGoal(body, goal?.id),
  );
  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={form.handleSubmit(async (body) => {
        try {
          await save.mutateAsync(body);
          toast.success('Goal saved');
          done();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      })}
    >
      {(['title', 'description'] as const).map((name) => (
        <label key={name} className="block space-y-2 text-sm">
          {name === 'title' ? 'Title' : 'Description (optional)'}
          {name === 'description' ? (
            <Textarea
              {...form.register(name, { setValueAs: (v) => v || null })}
            />
          ) : (
            <Input {...form.register(name)} />
          )}
          <FieldError
            message={form.formState.errors[name]?.message}
            className="text-destructive"
          />
        </label>
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          Category
          <select
            className="block h-10 w-full rounded-md border bg-background px-3"
            {...form.register('category', {
              onChange: () => form.setValue('activity_ids', []),
            })}
          >
            {activityCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Period
          <select
            className="block h-10 w-full rounded-md border bg-background px-3"
            {...form.register('period')}
          >
            <option>DAILY</option>
            <option>WEEKLY</option>
          </select>
        </label>
        <label className="space-y-2 text-sm">
          Target completions
          <Input
            type="number"
            min="1"
            max="100"
            {...form.register('target_count', { valueAsNumber: true })}
          />
        </label>
        <label className="space-y-2 text-sm">
          Timezone
          <Input {...form.register('timezone')} />
          <FieldError
            message={form.formState.errors.timezone?.message}
            className="text-destructive"
          />
        </label>
        <label className="space-y-2 text-sm">
          Start date
          <Input type="date" {...form.register('start_date')} />
        </label>
        <label className="space-y-2 text-sm">
          End date (optional)
          <Input
            type="date"
            {...form.register('end_date', { setValueAs: (v) => v || null })}
          />
          <FieldError
            message={form.formState.errors.end_date?.message}
            className="text-destructive"
          />
        </label>
      </div>
      <fieldset
        className="space-y-3"
        aria-describedby="goal-activities-help goal-activities-error"
        aria-invalid={!!form.formState.errors.activity_ids}
      >
        <legend className="mb-3 text-sm font-medium">
          Associated activities
        </legend>
        <p id="goal-activities-help" className="text-sm text-muted-foreground">
          Choose at least one activity. Completing a selected activity counts
          toward this goal.
        </p>
        {!eligibleActivities.length && (
          <p
            role="status"
            className="rounded-lg border bg-muted/30 p-4 text-sm"
          >
            No activities are available for this category. Choose another
            category or ask an administrator to publish activities.
          </p>
        )}
        {eligibleActivities.map((a) => (
          <label
            key={a.id}
            className="flex items-center gap-3 rounded-lg border p-3 text-sm"
          >
            <input
              type="checkbox"
              name="activity_ids"
              value={a.id}
              checked={selected.includes(a.id)}
              onChange={(e) =>
                form.setValue(
                  'activity_ids',
                  e.target.checked
                    ? [...selected, a.id]
                    : selected.filter((id) => id !== a.id),
                  { shouldValidate: true, shouldDirty: true },
                )
              }
            />
            {a.title}
          </label>
        ))}
        <FieldError
          id="goal-activities-error"
          message={form.formState.errors.activity_ids?.message}
          className="text-sm text-destructive"
        />
      </fieldset>
      <FormErrors errors={form.formState.errors} />
      <Button
        type="submit"
        disabled={save.isPending || !eligibleActivities.length}
      >
        {save.isPending ? 'Saving...' : 'Save goal'}
      </Button>
    </form>
  );
}
export function GoalCard({
  goal: g,
  edit,
  activities,
}: {
  goal: WellnessGoal;
  edit: () => void;
  activities: Activity[];
}) {
  const change = useWellnessMutation((status: WellnessGoal['status']) =>
    wellnessApi.goalStatus(g.id, status),
  );
  const p = g.progress;
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <p className="text-xs font-medium text-primary">
          {g.period} · {g.status} · {g.timezone}
        </p>
        <h2 className="text-xl font-semibold">{g.title}</h2>
        {g.description && (
          <p className="text-sm text-muted-foreground">{g.description}</p>
        )}
        <p className="text-2xl font-semibold">
          {p?.count ?? 0}/{g.target_count}{' '}
          <span className="text-sm font-normal text-muted-foreground">
            {p?.percentage ?? 0}%
          </span>
        </p>
        <Progress
          value={p?.percentage ?? 0}
          aria-label={g.title + ' progress'}
        />
        <p className="text-sm">
          Current streak: {p?.currentStreak ?? 0} {p?.streakUnit} · Longest:{' '}
          {p?.longestStreak ?? 0}
        </p>
        <p className="text-xs text-muted-foreground">
          {p?.periodStart} to {p?.periodEnd}. Linked:{' '}
          {g.activity_ids
            .map(
              (id) =>
                activities.find((a) => a.id === id)?.title ??
                'Archived activity',
            )
            .join(', ')}
          .
        </p>
        <details className="text-sm">
          <summary>Completion history and tracking rules</summary>
          <p className="my-3 text-xs text-muted-foreground">
            Tracking from {g.tracking_start}. Paused days reset a streak and do
            not count. A resume day remains excluded; counting resumes the next
            day. Weekly periods use Monday–Sunday and any paused day excludes
            that week from streaks. Previous definitions retained:{' '}
            {g.definition_history.length}.
          </p>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {p?.history
              .slice()
              .reverse()
              .map((h) => (
                <p key={h.date}>
                  {h.date}: {h.count}/{h.target} ·{' '}
                  {h.paused
                    ? 'Paused'
                    : h.met
                      ? 'Target met'
                      : 'Target not yet met'}
                </p>
              ))}
          </div>
        </details>
        {g.status !== 'ARCHIVED' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={edit}>
              Edit
            </Button>
            <Button
              variant="outline"
              disabled={change.isPending}
              onClick={async () => {
                try {
                  await change.mutateAsync(
                    g.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                  );
                  toast.success('Goal updated');
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              {g.status === 'ACTIVE' ? 'Pause' : 'Resume'}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" disabled={change.isPending}>
                  Archive
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive this goal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its saved history and activity sessions remain available.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      try {
                        await change.mutateAsync('ARCHIVED');
                        toast.success('Goal archived');
                      } catch (e) {
                        toast.error(errorMessage(e));
                      }
                    }}
                  >
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
