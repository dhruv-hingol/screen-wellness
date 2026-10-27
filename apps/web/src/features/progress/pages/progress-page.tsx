import { useState } from 'react';
import { assessmentCategories } from '@screenwise/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/page-elements';
import { errorMessage } from '@/lib/errors';
import { usePersonalAnalytics } from '../hooks/use-analytics';
import { analyticsApi, type AnalyticsFilters } from '../services/analytics-api';
import { DateRangeFilter } from '../components/date-range-filter';
import {
  ActivityCompletionChart,
  AssessmentTrendChart,
  ActivityDistributionChart,
} from '../components/analytics-charts';
import {
  AnalyticsLoading,
  AnalyticsError,
  ProgressSummary,
  GoalAnalyticsView,
  ActivityTimeline,
  StreakNote,
  label,
} from '../components/analytics-elements';
export function ProgressPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ range: '30d' });
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [exporting, setExporting] = useState(false);
  const query = usePersonalAnalytics({
    ...filters,
    page,
    category: category || undefined,
  });
  const data = query.data;
  async function download() {
    setExporting(true);
    try {
      const report = await analyticsApi.report(filters);
      const { generateWellnessReport } =
        await import('../reports/generate-wellness-report');
      await generateWellnessReport(report);
      toast.success('Wellness report downloaded');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your wellness progress"
        description="Explore saved assessments, self-reported activities and the goals you chose."
        action={
          <Button disabled={exporting || !data} onClick={() => void download()}>
            {exporting ? 'Preparing report…' : 'Download report (PDF)'}
          </Button>
        }
      />
      <DateRangeFilter
        value={filters}
        timezone={data?.period.timezone}
        onChange={(v) => {
          setFilters(v);
          setPage(1);
        }}
      />
      <label className="block space-y-2 text-sm">
        <span>Assessment category (charts and result history)</span>
        <select
          className="block h-10 max-w-full rounded-lg border bg-background px-3"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {assessmentCategories.map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </select>
      </label>
      {query.isPending ? (
        <AnalyticsLoading />
      ) : query.isError ? (
        <AnalyticsError error={query.error} retry={query.refetch} />
      ) : (
        data && (
          <>
            <p className="text-sm text-muted-foreground">
              {data.period.startDate} – {data.period.endDate} ·{' '}
              {data.period.timezone}. The PDF includes all assessment categories
              for this range.
            </p>
            <ProgressSummary data={data} />
            <StreakNote streak={data.streak} />
            <AssessmentTrendChart
              series={data.assessments}
              timezone={data.period.timezone}
            />
            <div className="grid gap-6 lg:grid-cols-2">
              <ActivityCompletionChart data={data.daily} />
              <ActivityDistributionChart data={data.distribution} />
            </div>
            <GoalAnalyticsView goals={data.goals} />
            <ActivityTimeline
              page={data.timeline}
              timezone={data.period.timezone}
              onPage={setPage}
            />
          </>
        )
      )}
    </div>
  );
}
