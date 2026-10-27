import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { userApi } from '../services/user-api';
import { invalidateAnalyticsQueries } from '@/services/api';
export function useCurrentUser() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user', user?.id, 'profile'],
    queryFn: userApi.profile,
    enabled: !!user,
  });
}
export function useUserPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user', user?.id, 'preferences'],
    queryFn: userApi.preferences,
    enabled: !!user,
  });
}
export function useOnboarding() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user', user?.id, 'onboarding'],
    queryFn: userApi.onboarding,
    enabled: !!user,
  });
}
export function useWellnessGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user', user?.id, 'goals'],
    queryFn: userApi.goals,
    enabled: !!user,
  });
}
function useUserMutation<T, R>(mutationFn: (input: T) => Promise<R>) {
  const cache = useQueryClient();
  const { user, refreshProfile } = useAuth();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['user', user?.id] });
      await cache.invalidateQueries({ queryKey: ['wellness', user?.id] });
      await invalidateAnalyticsQueries(cache);
      await refreshProfile();
    },
  });
}
export const useUpdateProfile = () => useUserMutation(userApi.updateProfile);
export const useUpdatePreferences = () =>
  useUserMutation(userApi.updatePreferences);
export const useSubmitOnboarding = () =>
  useUserMutation(userApi.submitOnboarding);
export const useReplaceGoals = () => useUserMutation(userApi.replaceGoals);
export const useUploadAvatar = () => useUserMutation(userApi.avatar);
