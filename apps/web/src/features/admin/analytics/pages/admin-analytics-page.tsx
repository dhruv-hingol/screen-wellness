import { useState } from 'react';
import { PageHeader, StatCard } from '@/components/common/page-elements';
import { useAdminAnalytics } from '@/features/progress/hooks/use-analytics';
import { DateRangeFilter } from '@/features/progress/components/date-range-filter';
import {
  AnalyticsLoading,
  AnalyticsError,
} from '@/features/progress/components/analytics-elements';
import { AdminAnalyticsChart } from '@/features/progress/components/analytics-charts';
import type { AnalyticsFilters } from '@/features/progress/services/analytics-api';
export function AdminAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ range: '30d' });
  const query = useAdminAnalytics(filters);
  const data = query.data;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform analytics"
        description="Aggregate platform use, content and engagement. Individual questionnaire responses and personal health records are excluded."
      />
      <DateRangeFilter
        value={filters}
        onChange={setFilters}
        timezone={data?.period.timezone}
      />
      {query.isPending ? (
        <AnalyticsLoading />
      ) : query.isError ? (
        <AnalyticsError error={query.error} retry={query.refetch} />
      ) : (
        data && (
          <>
            <p className="text-sm text-muted-foreground">
              {data.period.startDate} – {data.period.endDate} ·{' '}
              {data.period.timezone}. {data.activeUserDefinition} Totals for
              registered users, published articles and active activity
              definitions are current inventory; usage and registrations below
              follow the selected dates.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Registered users"
                value={data.overview.users}
                description="Current registered profiles"
              />
              <StatCard
                label="Active users"
                value={data.overview.activeUsers.value ?? 'Suppressed'}
                description="Distinct users with qualifying completions"
              />
              <StatCard
                label="Completed assessments"
                value={data.overview.assessments.value ?? 'Suppressed'}
                description="Selected range"
              />
              <StatCard
                label="Completed activities"
                value={data.overview.activities.value ?? 'Suppressed'}
                description="Selected range"
              />
              <StatCard
                label="Published articles"
                value={data.overview.publishedArticles}
                description="Current content inventory"
              />
              <StatCard
                label="Active wellness activities"
                value={data.overview.activeActivities}
                description="Current available activity definitions"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Small-group threshold: {data.suppressionThreshold} distinct
              contributors per nonempty group. Suppressed values are
              unavailable, not zero. Behavioral totals are also hidden when a
              related breakdown is suppressed.
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              <AdminAnalyticsChart
                title="User registrations"
                rows={data.users}
              />
              <AdminAnalyticsChart
                title="Assessment usage"
                rows={data.assessments}
              />
              <AdminAnalyticsChart
                title="Activity engagement"
                rows={data.activities}
              />
              <AdminAnalyticsChart
                title="Content overview"
                rows={data.content}
              />
            </div>
            <AdminAnalyticsChart
              title="Daily platform engagement"
              rows={data.engagement}
            />
          </>
        )
      )}
    </div>
  );
}
