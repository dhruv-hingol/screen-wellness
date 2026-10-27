import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { assessmentApi } from '../services/assessment-api';
import { invalidateAnalyticsQueries } from '@/services/api';
export function useAssessmentList(
  params: Record<string, unknown>,
  admin = false,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['assessments', user?.id, admin, params],
    queryFn: () =>
      admin ? assessmentApi.adminList(params) : assessmentApi.list(params),
  });
}
export function useAssessment(id: string, admin = false) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['assessment', user?.id, id, admin],
    queryFn: () =>
      admin ? assessmentApi.adminDetail(id) : assessmentApi.detail(id),
    enabled: !!id,
  });
}
export function useAttempt(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['attempt', user?.id, id],
    queryFn: () => assessmentApi.result(id),
  });
}
export function useHistory(params: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['history', user?.id, params],
    queryFn: () => assessmentApi.history(params),
  });
}
export function useTrends(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['trends', user?.id, id],
    queryFn: () => assessmentApi.trends(id),
    enabled: !!id,
  });
}
export function useAssessmentMutation<T, R>(fn: (input: T) => Promise<R>) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(
        [
          'assessments',
          'assessment',
          'attempt',
          'history',
          'trends',
          'recommendations',
          'rules',
        ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
      );
      await invalidateAnalyticsQueries(cache);
    },
  });
}
