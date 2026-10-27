import { Link } from 'react-router';
import { PageHeader } from '@/components/common/page-elements';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/features/auth/auth-provider';
import {
  useDashboardSummary,
  useDashboardRecommendations,
  usePersonalAnalytics,
} from '@/features/progress/hooks/use-analytics';
import {
  AnalyticsLoading,
  AnalyticsError,
  Section,
  NoData,
  GoalAnalyticsView,
  ActivityTimeline,
  StreakNote,
  formatAt,
} from '@/features/progress/components/analytics-elements';
import {
  ActivityCompletionChart,
  AssessmentTrendChart,
} from '@/features/progress/components/analytics-charts';
import { RecommendationCard } from '@/features/recommendations/components/recommendation-card';
export function DashboardPage() {
  const { profile } = useAuth();
  const summary = useDashboardSummary();
  const analytics = usePersonalAnalytics({ range: '7d', pageSize: 5 });
  const recommendations = useDashboardRecommendations();
  const data = summary.data;
  const latest = data?.latestAssessment;
  const timezone = data?.period.timezone;
  const date = new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    dateStyle: 'full',
  }).format(new Date());
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  );
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="space-y-6">
      <PageHeader
        title={
          greeting +
          ', ' +
          (profile?.full_name?.trim().split(/\s+/)[0] || 'there')
        }
        description={date + '. Make room for a small moment of balance today.'}
      />
      <div className="flex flex-wrap gap-3">
        {[
          ['Start assessment', '/assessments'],
          ['Start eye break', '/prevention#eye-break'],
          ['View wellness plan', '/wellness-plan'],
          ['Explore activities', '/prevention'],
        ].map(([title, to]) => (
          <Button
            key={to}
            variant={to === '/assessments' ? 'default' : 'outline'}
            asChild
          >
            <Link to={to!}>{title}</Link>
          </Button>
        ))}
      </div>
      {summary.isPending ? (
        <AnalyticsLoading />
      ) : summary.isError ? (
        <AnalyticsError error={summary.error} retry={summary.refetch} />
      ) : (
        data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Section title="Latest assessment">
                {latest ? (
                  <>
                    <p className="font-medium">{latest.title}</p>
                    <p className="text-sm">{latest.feedback}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAt(latest.date, data.period.timezone)}
                    </p>
                    <Button asChild variant="outline">
                      <Link to={'/assessments/results/' + latest.id}>
                        View result
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <NoData>No assessment completed yet.</NoData>
                    <Button asChild>
                      <Link to="/assessments">Start assessment</Link>
                    </Button>
                  </>
                )}
              </Section>
              <Section title="Today's activities">
                <p className="text-3xl font-semibold">
                  {data.todayActivities.completed}
                </p>
                <p className="text-xs text-muted-foreground">
                  Completed sessions today
                  {data.todayActivities.target !== null
                    ? '; saved checklist has ' +
                      data.todayActivities.target +
                      ' suggested activities. Repeat sessions count separately.'
                    : '. Open your daily checklist to save a suggested plan.'}
                </p>
                {data.todayActivities.target !== null &&
                  data.todayActivities.target > 0 && (
                    <>
                      <Progress
                        aria-label="Daily checklist completion"
                        value={Math.min(
                          100,
                          (100 * data.todayActivities.plannedCompleted) /
                            data.todayActivities.target,
                        )}
                      />
                      <p className="text-xs text-muted-foreground">
                        {data.todayActivities.plannedCompleted} /{' '}
                        {data.todayActivities.target} planned activities
                        completed
                      </p>
                    </>
                  )}
                <Button asChild variant="outline">
                  <Link to="/prevention/daily-checklist">View activities</Link>
                </Button>
              </Section>
              <Section title="Active goals">
                <p className="text-3xl font-semibold">{data.activeGoals}</p>
                <p className="text-sm">
                  {data.achievedGoals} goal periods achieved over the last seven
                  days
                </p>
                <Button asChild variant="outline">
                  <Link to="/goals">View goals</Link>
                </Button>
              </Section>
              <Section title="Wellness streak">
                <p className="text-3xl font-semibold">
                  {data.streak.current}{' '}
                  <span className="text-base">{data.streak.unit}</span>
                </p>
                <StreakNote streak={data.streak} />
              </Section>
            </div>
          </>
        )
      )}
      {analytics.isPending ? (
        <AnalyticsLoading />
      ) : analytics.isError ? (
        <AnalyticsError error={analytics.error} retry={analytics.refetch} />
      ) : (
        analytics.data && (
          <>
            <ActivityCompletionChart
              data={analytics.data.daily}
              title="Your last seven days"
            />
            <AssessmentTrendChart
              series={analytics.data.assessments}
              timezone={analytics.data.period.timezone}
            />
            <GoalAnalyticsView goals={analytics.data.goals} preview />
            <ActivityTimeline
              page={analytics.data.timeline}
              timezone={analytics.data.period.timezone}
            />
          </>
        )
      )}
      <Section
        title="Today's wellness plan"
        description="Current active educational recommendations from your assessments and chosen wellness interests."
      >
        {recommendations.isPending ? (
          <AnalyticsLoading />
        ) : recommendations.isError ? (
          <AnalyticsError
            error={recommendations.error}
            retry={recommendations.refetch}
          />
        ) : recommendations.data?.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {recommendations.data.map((r) => (
              <RecommendationCard key={r.id} recommendation={r} />
            ))}
          </div>
        ) : (
          <NoData>
            Your plan is ready for its first step. Complete an assessment or
            refresh recommendations from your wellness plan.
          </NoData>
        )}
        <Button asChild variant="outline">
          <Link to="/wellness-plan">View full wellness plan</Link>
        </Button>
      </Section>
    </div>
  );
}
