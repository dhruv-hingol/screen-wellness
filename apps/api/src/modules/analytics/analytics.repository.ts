import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PersonalAnalytics,
  WellnessGoal,
  AdminAnalytics,
  DashboardSummary,
  AnalyticsQuery,
  ReportingPeriod,
} from '@screenwise/shared';
import { getAdminClient } from '../../config/supabase.js';
import { AppError } from '../../utils/app-error.js';
export interface AnalyticsRecords extends Omit<
  PersonalAnalytics,
  'goals' | 'streak'
> {
  goalDefinitions: WellnessGoal[];
  goalCounts: Record<string, Record<string, number>>;
  goalAsOf: Record<string, string>;
}
function checked<T>(result: {
  data: unknown;
  error: { code?: string } | null;
}): T {
  if (result.error || result.data === null)
    throw new AppError(
      503,
      'ANALYTICS_UNAVAILABLE',
      'Analytics are unavailable. Check database connectivity and apply the documented pending migrations through Phase 6 (008), then retry.',
    );
  return result.data as T;
}
export class AnalyticsRepository {
  constructor(
    public userId: string,
    private scoped: SupabaseClient,
  ) {}
  async timezone() {
    const row = checked<{ timezone: string }>(
      await this.scoped
        .from('user_preferences')
        .select('timezone')
        .eq('user_id', this.userId)
        .single(),
    );
    return row.timezone;
  }
  async personal(period: ReportingPeriod, query: AnalyticsQuery) {
    return checked<AnalyticsRecords>(
      await getAdminClient().rpc('personal_wellness_analytics', {
        p_user_id: this.userId,
        p_start: period.startDate,
        p_end: period.endDate,
        p_timezone: period.timezone,
        p_category: query.category ?? null,
        p_page: query.page,
        p_page_size: query.pageSize,
      }),
    );
  }
  async dashboard(timezone: string) {
    return checked<
      Pick<DashboardSummary, 'latestAssessment' | 'todayActivities'>
    >(
      await getAdminClient().rpc('dashboard_wellness_summary', {
        p_user_id: this.userId,
        p_timezone: timezone,
      }),
    );
  }
  async admin(period: ReportingPeriod) {
    return checked<AdminAnalytics>(
      await getAdminClient().rpc('admin_wellness_analytics', {
        p_admin_id: this.userId,
        p_start: period.startDate,
        p_end: period.endDate,
        p_timezone: period.timezone,
      }),
    );
  }
}
