import type {
  ApiResponse,
  UserProfile,
  UserPreferences,
  OnboardingData,
  ProfilePatch,
  PreferencesPatch,
  OnboardingInput,
  GoalKey,
} from '@screenwise/shared';
import { api } from '@/services/api';
async function unwrap<T>(request: Promise<{ data: ApiResponse<T> }>) {
  const { data } = await request;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}
export const userApi = {
  profile: () => unwrap<UserProfile>(api.get('/users/me')),
  preferences: () => unwrap<UserPreferences>(api.get('/users/preferences')),
  onboarding: () => unwrap<OnboardingData>(api.get('/users/onboarding')),
  goals: () => unwrap<GoalKey[]>(api.get('/users/wellness-goals')),
  updateProfile: (input: ProfilePatch) =>
    unwrap<UserProfile>(api.patch('/users/me', input)),
  updatePreferences: (input: PreferencesPatch) =>
    unwrap<UserPreferences>(api.patch('/users/preferences', input)),
  submitOnboarding: (input: OnboardingInput) =>
    unwrap<OnboardingData>(api.post('/users/onboarding', input)),
  replaceGoals: (goals: GoalKey[]) =>
    unwrap<GoalKey[]>(api.put('/users/wellness-goals', { goals })),
  avatar: (file: File) => {
    const body = new FormData();
    body.append('avatar', file);
    return unwrap<UserProfile>(api.post('/users/avatar', body));
  },
};
