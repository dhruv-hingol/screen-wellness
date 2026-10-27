import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { activityCategories } from '@screenwise/shared';
import { useAuth } from '@/features/auth/auth-provider';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWellnessQuery } from '../hooks/use-wellness';
import { wellnessApi } from '../services/wellness-api';
import {
  ActivityCard,
  activityIcons,
  activityCategoryLabels,
} from '../components/activity-card';
import { EyeBreakTimer } from '../components/eye-break-timer';
export function PreventionPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [duration, setDuration] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);
  const query = useWellnessQuery(
    ['activities', debounced, category, duration, difficulty, page],
    () =>
      wellnessApi.activities({
        search: debounced,
        category: category || undefined,
        maxDuration: duration || undefined,
        difficulty: difficulty || undefined,
        page,
      }),
  );
  const today = useWellnessQuery(['today'], () => wellnessApi.today());
  const eye = useWellnessQuery(['visual-break'], () =>
    wellnessApi.activities({
      search: '20',
      category: 'EYE_COMFORT',
      pageSize: 100,
    }),
  );
  return (
    <>
      <PageHeader
        title={'Make room for yourself, ' + (profile?.full_name || 'today')}
        description="Small activities to support a more comfortable digital routine."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/prevention/daily-checklist">Daily checklist</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/prevention/history">Activity history</Link>
            </Button>
          </div>
        }
      />
      <div id="eye-break" className="mb-7 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <EyeBreakTimer
          activityId={
            eye.data?.data.find((a) => a.slug === '20-20-20-visual-break')?.id
          }
        />
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Your day, at your pace</h2>
          {today.isPending ? (
            <p>Loading today’s summary...</p>
          ) : today.isError ? (
            <QueryError
              error={today.error}
              retry={() => void today.refetch()}
            />
          ) : (
            <>
              <p className="text-3xl font-semibold text-primary">
                {today.data.completedActivityIds.length} activities completed
              </p>
              <p className="text-sm text-muted-foreground">
                Today in {today.data.timezone}. Completion is based on your
                confirmed saved sessions.
              </p>
              <p className="font-medium">
                {today.data.goals.length} active goals
              </p>
              {today.data.goals.slice(0, 3).map((g) => (
                <p key={g.id} className="text-sm">
                  {g.title} · {g.progress?.count}/{g.target_count}
                </p>
              ))}
              <Button asChild variant="outline">
                <Link to="/goals">Manage goals</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      <section
        aria-label="Activity categories"
        className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5"
      >
        {activityCategories
          .filter((c) => c !== 'GENERAL')
          .map((c) => {
            const Icon = activityIcons[c];
            return (
              <Button
                key={c}
                variant={category === c ? 'default' : 'outline'}
                className="h-auto justify-start whitespace-normal py-4"
                aria-pressed={category === c}
                onClick={() => {
                  setCategory(category === c ? '' : c);
                  setPage(1);
                }}
              >
                <Icon aria-hidden="true" className="size-5" />
                {activityCategoryLabels[c]}
              </Button>
            );
          })}
      </section>
      {!!today.data?.activities.filter(
        (a) => !today.data.completedActivityIds.includes(a.id),
      ).length && (
        <section aria-labelledby="suggested-activities" className="mb-8">
          <h2 id="suggested-activities" className="mb-4 text-xl font-semibold">
            Suggested for your day
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {today.data.activities
              .filter((a) => !today.data.completedActivityIds.includes(a.id))
              .slice(0, 3)
              .map((a) => (
                <ActivityCard key={a.id} activity={a} source="CHECKLIST" />
              ))}
          </div>
        </section>
      )}
      <h2 className="mb-4 text-xl font-semibold">Explore activities</h2>
      <div className="mb-5 flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search activities"
          placeholder="Search activities"
        />
        <select
          aria-label="Activity category"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {activityCategories.map((c) => (
            <option key={c} value={c}>
              {activityCategoryLabels[c]}
            </option>
          ))}
        </select>
        <select
          aria-label="Maximum duration"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={duration}
          onChange={(e) => {
            setDuration(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any duration</option>
          <option value="60">Up to 1 minute</option>
          <option value="300">Up to 5 minutes</option>
          <option value="600">Up to 10 minutes</option>
        </select>
        <select
          aria-label="Difficulty"
          className="h-10 rounded-md border bg-background px-3 text-sm"
          value={difficulty}
          onChange={(e) => {
            setDifficulty(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any difficulty</option>
          <option>EASY</option>
          <option>MODERATE</option>
        </select>
      </div>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.data.map((a) => (
              <ActivityCard
                key={a.id}
                activity={a}
                completed={today.data?.completedActivityIds.includes(a.id)}
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
          title="No activities match"
          description="Try different filters. An administrator can publish activities if this collection is empty."
        />
      )}
    </>
  );
}
