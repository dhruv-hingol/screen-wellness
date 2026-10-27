import { api } from '@/services/api';
import type {
  ApiResponse,
  PersonalAnalytics,
  DashboardSummary,
  Recommendation,
  AdminAnalytics,
  WellnessReportData,
} from '@screenwise/shared';
export type AnalyticsFilters = {
  range?: '7d' | '30d' | '90d';
  startDate?: string;
  endDate?: string;
  category?: string;
  page?: number;
  pageSize?: number;
};
export async function analyticsGet<T>(path: string, params?: AnalyticsFilters) {
  const { data } = await api.get<ApiResponse<T>>(path, {
    params,
    timeout: 30000,
  });
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}
export const analyticsApi = {
  personal: (filters: AnalyticsFilters) =>
    analyticsGet<PersonalAnalytics>('/analytics/dashboard', filters),
  summary: () => analyticsGet<DashboardSummary>('/dashboard/summary'),
  recommendations: () =>
    analyticsGet<Recommendation[]>('/dashboard/recommendations'),
  admin: (filters: AnalyticsFilters) =>
    analyticsGet<AdminAnalytics>('/admin/analytics/dashboard', filters),
  report: (filters: AnalyticsFilters) =>
    analyticsGet<WellnessReportData>('/analytics/report-data', filters),
};
