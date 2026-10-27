import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  UserProfile,
  UserPreferences,
  GoalKey,
  ProfilePatch,
  PreferencesPatch,
  OnboardingInput,
} from '@screenwise/shared';
import { getAdminClient } from '../../config/supabase.js';
import { AppError } from '../../utils/app-error.js';
function failed(error: unknown) {
  if (error)
    throw new AppError(
      503,
      'DATA_UNAVAILABLE',
      'Unable to save or load account data. Please try again.',
    );
}
export class UserRepository {
  constructor(
    private userId: string,
    private scoped: SupabaseClient,
  ) {}
  async profile() {
    const { data, error } = await this.scoped
      .from('profiles')
      .select('*')
      .eq('id', this.userId)
      .single();
    failed(error);
    return data as UserProfile;
  }
  async preferences() {
    const { data, error } = await this.scoped
      .from('user_preferences')
      .select('*')
      .eq('user_id', this.userId)
      .single();
    failed(error);
    return data as UserPreferences;
  }
  async goals() {
    const { data, error } = await this.scoped
      .from('user_wellness_goals')
      .select('goal_key')
      .eq('user_id', this.userId)
      .order('goal_key');
    failed(error);
    return (data ?? []).map((v) => v.goal_key as GoalKey);
  }
  async updateProfile(input: ProfilePatch) {
    const { data, error } = await getAdminClient()
      .from('profiles')
      .update(input)
      .eq('id', this.userId)
      .select('*')
      .single();
    failed(error);
    return data as UserProfile;
  }
  async updatePreferences(input: PreferencesPatch) {
    const { data, error } = await getAdminClient()
      .from('user_preferences')
      .update(input)
      .eq('user_id', this.userId)
      .select('*')
      .single();
    failed(error);
    return data as UserPreferences;
  }
  async replaceGoals(goals: GoalKey[]) {
    const { error } = await getAdminClient().rpc('replace_wellness_goals', {
      p_user_id: this.userId,
      p_goals: goals,
    });
    failed(error);
    return this.goals();
  }
  async submitOnboarding(input: OnboardingInput) {
    const { error } = await getAdminClient().rpc('complete_onboarding', {
      p_user_id: this.userId,
      p_answers: input,
    });
    failed(error);
  }
  async setAvatar(path: string) {
    const { error } = await getAdminClient()
      .from('profiles')
      .update({ avatar_url: path })
      .eq('id', this.userId);
    failed(error);
  }
}
