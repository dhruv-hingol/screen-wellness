import { useState } from 'react';
import { Link } from 'react-router';
import { useWellnessQuery } from '../hooks/use-wellness';
import { wellnessApi } from '../services/wellness-api';
import { ActivityCard } from '../components/activity-card';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
} from '@/features/assessments/components/assessment-elements';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
export function DailyChecklistPage() {
  const [date, setDate] = useState('');
  const query = useWellnessQuery(['checklist', date], () =>
    wellnessApi.today({ date: date || undefined }),
  );
  return (
    <>
      <PageHeader
        title="Your daily wellness checklist"
        description="A few intentional moments, with completions saved to your account."
      />
      <label className="mb-6 block max-w-xs space-y-2 text-sm">
        Review a date
        <Input
          type="date"
          value={date}
          max={query.data?.date && !date ? query.data.date : undefined}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {query.data.date} · {query.data.timezone} ·{' '}
            {
              query.data.activities.filter((a) =>
                query.data.completedActivityIds.includes(a.id),
              ).length
            }
            /{query.data.activities.length} planned activities completed
          </p>
          <Progress
            value={
              query.data.activities.length
                ? (query.data.activities.filter((a) =>
                    query.data.completedActivityIds.includes(a.id),
                  ).length /
                    query.data.activities.length) *
                  100
                : 0
            }
            aria-label="Daily checklist completion"
          />
          {!query.data.recordedPlan && (
            <p className="my-5 text-sm text-muted-foreground">
              No checklist was recorded for this date. Only saved completed
              activities are shown; missed activities are not invented.
            </p>
          )}
          <div className="my-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {query.data.activities.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                completed={query.data.completedActivityIds.includes(a.id)}
                source="CHECKLIST"
                completionLabel={'Completed on ' + query.data.date}
              />
            ))}
          </div>
          {!query.data.activities.length && (
            <EmptyState
              title="No activities for this date"
              description="No saved completions or checklist plan are available."
            />
          )}
          <h2 className="mb-4 text-xl font-semibold">Your active goals</h2>
          {query.data.goals.map((g) => (
            <p key={g.id} className="mb-3 text-sm">
              <Link to="/goals" className="text-primary underline">
                {g.title}
              </Link>{' '}
              · {g.progress?.count}/{g.target_count} in the current{' '}
              {g.period.toLowerCase()} period
            </p>
          ))}
          <p className="mt-5 text-xs text-muted-foreground">
            Starting an activity always records a new session for the current
            time, even when reviewing a previous day.
          </p>
        </>
      )}
    </>
  );
}
