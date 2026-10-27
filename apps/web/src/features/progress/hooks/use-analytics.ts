import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { queryKeys } from '@/services/api';
import { analyticsApi, type AnalyticsFilters } from '../services/analytics-api';
export function usePersonalAnalytics(filters: AnalyticsFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.analytics.personal(user?.id ?? '', filters),
    queryFn: () => analyticsApi.personal(filters),
    enabled: !!user,
    staleTime: 60000,
  });
}
export function useAdminAnalytics(filters: AnalyticsFilters) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.adminAnalytics.dashboard(user?.id ?? '', filters),
    queryFn: () => analyticsApi.admin(filters),
    enabled: !!user,
    staleTime: 60000,
  });
}
export function useDashboardSummary() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard.summary(user?.id ?? ''),
    queryFn: analyticsApi.summary,
    enabled: !!user,
    staleTime: 60000,
  });
}
export function useDashboardRecommendations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.dashboard.recommendations(user?.id ?? ''),
    queryFn: analyticsApi.recommendations,
    enabled: !!user,
    staleTime: 60000,
  });
}
