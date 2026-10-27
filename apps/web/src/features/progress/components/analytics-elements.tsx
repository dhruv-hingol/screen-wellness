import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type {
  AnalyticsEvent,
  GoalAnalytics,
  StreakSummary,
  PersonalAnalytics,
  AnalyticsPage,
} from '@screenwise/shared';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/common/page-elements';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { errorMessage } from '@/lib/errors';
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
export function AnalyticsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading wellness data"
      className="grid gap-4 sm:grid-cols-2"
    >
      <Skeleton className="h-32" />
      <Skeleton className="h-32" />
      <Skeleton className="h-64 sm:col-span-2" />
    </div>
  );
}
export function AnalyticsError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => unknown;
}) {
  return (
    <div role="alert" className="space-y-3 rounded-xl border p-5">
      <p>{errorMessage(error)}</p>
      <Button variant="outline" onClick={() => void retry()}>
        Retry loading data
      </Button>
    </div>
  );
}
export function NoData({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-muted/50 p-5 text-sm text-muted-foreground">
      {children}
    </p>
  );
}
export function formatAt(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
export function label(value: string) {
  return value === 'GENERAL'
    ? 'General Wellness'
    : value
        .toLowerCase()
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (s) => s.toUpperCase());
}
export function StreakNote({ streak }: { streak: StreakSummary }) {
  return (
    <p className="text-xs text-muted-foreground">
      {streak.goalTitle
        ? `${streak.goalTitle}: ${streak.current} ${streak.unit}; longest ${streak.longest}. Consecutive achieved goal periods; pauses and missed finished periods break the run. An unfinished current period has until its end.`
        : 'Create a daily or weekly goal to track a streak. No applicable goal streak is recorded.'}
    </p>
  );
}
export function ProgressSummary({ data }: { data: PersonalAnalytics }) {
  const stats = [
    ['Assessments', data.overview.assessments, 'Completed in this range'],
    ['Activities', data.overview.activities, 'Saved completions in this range'],
    [
      'Active goals',
      data.overview.activeGoals,
      'Applicable at the end of the range',
    ],
    [
      'Goal achievement',
      `${data.goals.completionPercentage}%`,
      `${data.goals.achieved} achieved / ${data.goals.pending} pending periods`,
    ],
    [
      'Goal streak',
      `${data.streak.current} ${data.streak.unit}`,
      data.streak.goalTitle ?? 'No applicable goal',
    ],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {stats.map(([a, b, c]) => (
        <StatCard
          key={a}
          label={String(a)}
          value={b!}
          description={String(c)}
        />
      ))}
    </div>
  );
}
export function GoalAnalyticsView({
  goals,
  preview = false,
}: {
  goals: GoalAnalytics;
  preview?: boolean;
}) {
  const rows = preview
    ? goals.rows.filter((g) => g.status === 'ACTIVE').slice(0, 4)
    : goals.rows;
  return (
    <Section
      title={preview ? 'Your active goals' : 'Goal progress'}
      description="Current saved goal definitions, evaluated at the range end. Achievement uses unpaused periods starting in the range and completions within the selected local dates. Historical definitions are retained, not replayed."
    >
      {!rows.length ? (
        <NoData>
          No goals recorded.{' '}
          <Link className="underline" to="/goals">
            Choose a wellness goal
          </Link>
          .
        </NoData>
      ) : (
        <div className="space-y-5">
          {rows.map((g) => (
            <div key={g.id} className="space-y-2 rounded-lg border p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <Link to="/goals" className="font-medium hover:underline">
                  {g.title}
                </Link>
                <span className="text-xs">
                  {g.status} · {g.period.toLowerCase()}
                </span>
              </div>
              <p className="text-sm">
                {g.count} / {g.target} · {g.percentage}% · {g.periodStart} –{' '}
                {g.periodEnd} ({g.timezone})
              </p>
              <Progress
                aria-label={`${g.title} progress`}
                value={g.percentage}
              />
              {!preview && (
                <p className="text-xs text-muted-foreground">
                  In range: {g.history.filter((h) => h.met && !h.paused).length}{' '}
                  achieved,{' '}
                  {g.history.filter((h) => !h.met && !h.paused).length} pending,{' '}
                  {g.history.filter((h) => h.paused).length} paused periods.
                  Streak {g.currentStreak} {g.streakUnit}; longest{' '}
                  {g.longestStreak}.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <Button asChild variant="outline">
        <Link to="/goals">View goals</Link>
      </Button>
    </Section>
  );
}
export function ActivityTimeline({
  page,
  timezone,
  onPage,
}: {
  page: AnalyticsPage<AnalyticsEvent>;
  timezone: string;
  onPage?: (page: number) => void;
}) {
  return (
    <Section
      title="Recent wellness activity"
      description="Persisted assessments and self-reported activity completions. Duration records elapsed session time, not device-measured screen usage."
    >
      {!page.rows.length ? (
        <NoData>
          No completed activity in this range. Start with a short wellness break
          or an assessment.
        </NoData>
      ) : (
        <ol className="space-y-3">
          {page.rows.map((e) => (
            <li
              key={e.kind + e.id}
              className="rounded-lg border-l-4 border-primary/40 bg-muted/30 p-4"
            >
              <Link
                className="font-medium hover:underline"
                to={
                  e.kind === 'assessment'
                    ? '/assessments/results/' + e.id
                    : '/prevention/history'
                }
              >
                {e.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {label(e.category)} · {formatAt(e.date, timezone)}
                {e.durationSeconds !== null && e.durationSeconds >= 0
                  ? ` · ${Math.round(e.durationSeconds / 60)} min elapsed`
                  : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
      {onPage ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            disabled={page.page === 1}
            onClick={() => onPage(page.page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {page.page} of{' '}
            {Math.max(1, Math.ceil(page.total / page.pageSize))} · {page.total}{' '}
            records
          </span>
          <Button
            variant="outline"
            disabled={page.page * page.pageSize >= page.total}
            onClick={() => onPage(page.page + 1)}
          >
            Next
          </Button>
        </div>
      ) : (
        <Button asChild variant="outline">
          <Link to="/progress">View all activity</Link>
        </Button>
      )}
    </Section>
  );
}
