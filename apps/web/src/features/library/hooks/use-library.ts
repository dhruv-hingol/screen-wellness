import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
export function useLibraryQuery<T>(
  key: unknown[],
  fn: () => Promise<T>,
  enabled = true,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['library', user?.id, ...key],
    queryFn: fn,
    enabled: !!user && enabled,
  });
}
export function useLibraryMutation<T, R>(fn: (input: T) => Promise<R>) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        cache.invalidateQueries({ queryKey: ['library'] }),
        cache.invalidateQueries({ queryKey: ['admin-analytics'] }),
      ]),
  });
}
