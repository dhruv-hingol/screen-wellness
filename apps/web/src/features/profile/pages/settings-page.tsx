import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router';
import {
  onboardingSchema,
  passwordSchema,
  devices,
  type OnboardingInput,
  type OnboardingData,
} from '@screenwise/shared';
import { useAuth } from '@/features/auth/auth-provider';
import {
  useOnboarding,
  useUpdateProfile,
  useUpdatePreferences,
  useReplaceGoals,
  useUploadAvatar,
} from '../hooks/user-hooks';
import {
  PersonalFields,
  DeviceFields,
  HabitFields,
  GoalFields,
  SelectField,
} from '../components/fields';
import { onboardingDefaults } from '@/features/onboarding/pages/onboarding-page';
import {
  PageHeader,
  LoadingState,
  EmptyState,
} from '@/components/common/page-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUIStore } from '@/stores/ui-store';
import { requireSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
export function SettingsPage() {
  const query = useOnboarding();
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <EmptyState
        title="Unable to load settings"
        description={errorMessage(query.error)}
      >
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </EmptyState>
    );
  return <SettingsForm data={query.data} />;
}
function SettingsForm({ data }: { data: OnboardingData }) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const updatePrefs = useUpdatePreferences();
  const replaceGoals = useReplaceGoals();
  const avatar = useUploadAvatar();
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(data.preferences.theme);
  const [notifications, setNotifications] = useState(
    data.preferences.notifications_enabled,
  );
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: onboardingDefaults(data),
  });
  const {
    register,
    formState: { errors },
  } = form;
  const goals = useWatch({ control: form.control, name: 'goals' });
  const [tab, setTab] = useState('profile');
  const [failure, setFailure] = useState('');
  const reset = () => {
    form.reset(onboardingDefaults(data));
    setTheme(data.preferences.theme);
    setNotifications(data.preferences.notifications_enabled);
    setFailure('');
  };
  async function save() {
    setBusy(true);
    setFailure('');
    try {
      const v = form.getValues();
      if (tab === 'profile') {
        if (
          !(await form.trigger([
            'full_name',
            'occupation',
            'age_range',
            'primary_device',
          ]))
        )
          return;
        await updateProfile.mutateAsync({
          full_name: v.full_name,
          occupation: v.occupation,
        });
        await updatePrefs.mutateAsync({
          age_range: v.age_range,
          primary_device: v.primary_device,
        });
      }
      if (tab === 'wellness') {
        if (
          !(await form.trigger([
            'primary_device',
            'daily_screen_hours',
            'usage_purpose',
            'break_frequency',
            'sleep_time',
            'wake_time',
            'goals',
          ]))
        )
          return;
        await updatePrefs.mutateAsync({
          primary_device: v.primary_device,
          daily_screen_hours: v.daily_screen_hours,
          usage_purpose: v.usage_purpose,
          break_frequency: v.break_frequency,
          sleep_time: v.sleep_time,
          wake_time: v.wake_time,
        });
        await replaceGoals.mutateAsync(v.goals);
      }
      if (tab === 'appearance') {
        await updatePrefs.mutateAsync({ theme });
        useUIStore.getState().setTheme(theme);
      }
      if (tab === 'notifications')
        await updatePrefs.mutateAsync({ notifications_enabled: notifications });
      toast.success('Settings saved');
    } catch (e) {
      setFailure(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Settings"
        description="Make ScreenWise work for your daily routine."
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          reset();
          setTab(value);
        }}
      >
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start">
          {[
            ['profile', 'Profile'],
            ['wellness', 'Digital wellness'],
            ['appearance', 'Appearance'],
            ['security', 'Account security'],
            ['notifications', 'Notifications'],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value!}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Card>
          <CardContent className="max-w-2xl space-y-6 p-6 sm:p-8">
            <TabsContent value="profile" className="space-y-5">
              <h2 className="text-xl font-semibold">Your profile</h2>
              <div className="flex flex-wrap items-center gap-4">
                {profile?.avatar_url && (
                  <img
                    src={profile.avatar_url}
                    alt="Your avatar"
                    className="size-16 rounded-full object-cover"
                  />
                )}
                <label className="space-y-2 text-sm">
                  Avatar (PNG, JPEG or WebP, up to 2 MB)
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={avatar.isPending || busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (
                        file.size > 2097152 ||
                        !['image/png', 'image/jpeg', 'image/webp'].includes(
                          file.type,
                        )
                      ) {
                        toast.error('Choose PNG, JPEG or WebP up to 2 MB.');
                        return;
                      }
                      try {
                        await avatar.mutateAsync(file);
                        toast.success('Avatar updated');
                      } catch (error) {
                        toast.error(errorMessage(error));
                      }
                    }}
                  />
                </label>
              </div>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <PersonalFields register={register} errors={errors} />
              <SelectField
                label="Primary device"
                name="primary_device"
                options={devices}
                register={register}
                errors={errors}
              />
            </TabsContent>
            <TabsContent value="wellness" className="space-y-5">
              <h2 className="text-xl font-semibold">
                Digital wellness preferences
              </h2>
              <DeviceFields register={register} errors={errors} />
              <HabitFields register={register} errors={errors} />
              <GoalFields
                selected={goals ?? []}
                onChange={(v) =>
                  form.setValue('goals', v, { shouldValidate: true })
                }
              />
              <FieldError
                message={errors.goals?.message}
                className="text-sm text-destructive"
              />
            </TabsContent>
            <TabsContent value="appearance" className="space-y-5">
              <h2 className="text-xl font-semibold">Appearance</h2>
              <label className="block space-y-2 text-sm">
                Theme
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as typeof theme)}
                  className="block h-10 w-full rounded-md border bg-background px-3"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </label>
              <p className="text-sm text-muted-foreground">
                System follows your device's light or dark preference.
              </p>
            </TabsContent>
            <TabsContent value="notifications" className="space-y-5">
              <h2 className="text-xl font-semibold">Notifications</h2>
              <Link to="/settings/reminders" className="text-primary underline">
                Configure reminder schedules
              </Link>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                />
                Enable notifications
              </label>
              <p className="text-sm text-muted-foreground">
                Your preference is saved now. Notification delivery arrives in
                Phase 4.
              </p>
            </TabsContent>
            <TabsContent value="security" className="space-y-6">
              <PasswordForm />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await signOut();
                    navigate('/login', { replace: true });
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                Sign out
              </Button>
            </TabsContent>
            {tab !== 'security' && <FormErrors errors={errors} />}
            {failure && (
              <p role="alert" className="text-sm text-destructive">
                {failure}
              </p>
            )}
            {tab !== 'security' && (
              <div className="flex gap-3">
                <Button
                  disabled={busy || avatar.isPending}
                  onClick={() => void save()}
                >
                  {busy ? 'Saving...' : 'Save changes'}
                </Button>
                <Button variant="outline" disabled={busy} onClick={reset}>
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>
    </>
  );
}
const changeSchema = z
  .object({
    currentPassword: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
function PasswordForm() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [failure, setFailure] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changeSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={handleSubmit(async (v) => {
        setFailure('');
        try {
          const client = requireSupabase();
          const verified = await client.auth.signInWithPassword({
            email: user!.email!,
            password: v.currentPassword,
          });
          if (verified.error) throw verified.error;
          const { error } = await client.auth.updateUser({
            password: v.password,
          });
          if (error) throw error;
          await signOut();
          toast.success('Password changed. Sign in again.');
          navigate('/login', { replace: true });
        } catch (e) {
          setFailure(errorMessage(e));
        }
      })}
    >
      <h2 className="text-xl font-semibold">Change password</h2>
      {(['currentPassword', 'password', 'confirmPassword'] as const).map(
        (name) => (
          <label key={name} className="block space-y-2 text-sm">
            {name === 'currentPassword'
              ? 'Current password'
              : name === 'password'
                ? 'New password'
                : 'Confirm new password'}
            <Input
              type={visible ? 'text' : 'password'}
              autoComplete={
                name === 'currentPassword' ? 'current-password' : 'new-password'
              }
              {...register(name)}
            />
            <FieldError
              message={errors[name]?.message}
              className="text-xs text-destructive"
            />
          </label>
        ),
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
        />
        Show passwords
      </label>
      <p className="text-xs text-muted-foreground">
        Use 12+ characters with uppercase, lowercase, a number, and a symbol.
      </p>
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Updating...' : 'Change password'}
      </Button>
    </form>
  );
}
