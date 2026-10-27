import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { invalidateAnalyticsQueries } from '@/services/api';
export function useWellnessQuery<T>(
  key: unknown[],
  fn: () => Promise<T>,
  interval?: number,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['wellness', user?.id, ...key],
    queryFn: fn,
    enabled: !!user,
    refetchInterval: interval,
  });
}
export function useWellnessMutation<T, R>(
  fn: (input: T) => Promise<R>,
  affectsAnalytics = true,
) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['wellness'] }),
        cache.invalidateQueries({ queryKey: ['recommendations'] }),
        affectsAnalytics
          ? invalidateAnalyticsQueries(cache)
          : Promise.resolve(),
      ]);
    },
  });
}
