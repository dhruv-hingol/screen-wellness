import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { motion } from 'framer-motion';
import {
  onboardingSchema,
  goalLabels,
  type OnboardingInput,
  type OnboardingData,
} from '@screenwise/shared';
import {
  useOnboarding,
  useSubmitOnboarding,
} from '@/features/profile/hooks/user-hooks';
import { userApi } from '@/features/profile/services/user-api';
import {
  PersonalFields,
  DeviceFields,
  HabitFields,
  GoalFields,
} from '@/features/profile/components/fields';
import { LoadingState, EmptyState } from '@/components/common/page-elements';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Brand } from '@/components/layout/brand';
import { errorMessage } from '@/lib/errors';
import { destination } from '@/features/auth/route-guards';
import { useAuth } from '@/features/auth/auth-provider';
export function onboardingDefaults(
  data: OnboardingData,
): Partial<OnboardingInput> {
  const p = data.preferences;
  return {
    full_name: data.profile.full_name,
    occupation: data.profile.occupation ?? undefined,
    age_range: p.age_range,
    primary_device: p.primary_device ?? undefined,
    daily_screen_hours: p.daily_screen_hours ?? undefined,
    usage_purpose: p.usage_purpose ?? undefined,
    break_frequency: p.break_frequency ?? undefined,
    sleep_time: p.sleep_time?.slice(0, 5) ?? null,
    wake_time: p.wake_time?.slice(0, 5) ?? null,
    goals: data.goals,
  };
}
export function OnboardingPage() {
  const query = useOnboarding();
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <div className="p-8">
        <EmptyState
          title="Unable to load onboarding"
          description={errorMessage(query.error)}
        >
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </EmptyState>
      </div>
    );
  return <Wizard data={query.data} />;
}
const steps = [
  'Personal information',
  'Device usage',
  'Digital habits',
  'Wellness goals',
  'You are ready',
];
const stepFields: FieldPath<OnboardingInput>[][] = [
  ['full_name', 'occupation', 'age_range'],
  ['primary_device', 'daily_screen_hours', 'usage_purpose'],
  ['break_frequency', 'sleep_time', 'wake_time'],
  ['goals'],
];
function Wizard({ data }: { data: OnboardingData }) {
  const [step, setStep] = useState(data.profile.onboarding_completed ? 4 : 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = useSubmitOnboarding();
  const { profile, signOut } = useAuth();
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: onboardingDefaults(data),
  });
  const {
    register,
    formState: { errors },
  } = form;
  const goals = useWatch({ control: form.control, name: 'goals' }) ?? [];
  async function next() {
    if (step >= 4 || saving) return;
    setError('');
    if (!(await form.trigger(stepFields[step], { shouldFocus: true }))) return;
    setSaving(true);
    setError('');
    try {
      const values = form.getValues();
      if (step === 0) {
        await userApi.updateProfile({
          full_name: values.full_name,
          occupation: values.occupation,
        });
        await userApi.updatePreferences({ age_range: values.age_range });
      }
      if (step === 1)
        await userApi.updatePreferences({
          primary_device: values.primary_device,
          daily_screen_hours: values.daily_screen_hours,
          usage_purpose: values.usage_purpose,
        });
      if (step === 2)
        await userApi.updatePreferences({
          break_frequency: values.break_frequency,
          sleep_time: values.sleep_time,
          wake_time: values.wake_time,
        });
      if (step === 3) await submit.mutateAsync(onboardingSchema.parse(values));
      setStep((s) => s + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-8 flex justify-between">
        <Brand />
        <Button
          variant="ghost"
          onClick={() => void signOut().catch((e) => setError(errorMessage(e)))}
        >
          Sign out
        </Button>
      </div>
      <p className="mb-2 text-sm text-primary">Step {step + 1} of 5</p>
      <Progress value={(step + 1) * 20} aria-label="Onboarding progress" />
      <Card className="mt-7">
        <CardContent className="p-6 sm:p-9">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-2xl font-semibold">{steps[step]}</h1>
            <p className="mb-7 mt-2 text-sm text-muted-foreground">
              {step === 4
                ? 'Your preferences have been saved to your account.'
                : 'Let us make ScreenWise feel right for you. Completed steps are saved when you continue.'}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void next();
              }}
              className="space-y-5"
              noValidate
            >
              {step === 0 && (
                <PersonalFields register={register} errors={errors} />
              )}
              {step === 1 && (
                <DeviceFields register={register} errors={errors} />
              )}
              {step === 2 && (
                <HabitFields register={register} errors={errors} />
              )}
              {step === 3 && (
                <>
                  <GoalFields
                    selected={goals}
                    onChange={(v) =>
                      form.setValue('goals', v, { shouldValidate: true })
                    }
                  />
                  <FieldError
                    message={errors.goals?.message}
                    className="text-sm text-destructive"
                  />
                </>
              )}
              {step === 4 && (
                <div className="space-y-4">
                  <p>
                    <strong>{form.getValues('full_name')}</strong>, your profile
                    is ready.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Primary device: {form.getValues('primary_device')} | Daily
                    screen time: {form.getValues('daily_screen_hours')} hours
                  </p>
                  <ul className="list-inside list-disc space-y-2 text-sm">
                    {goals.map((g) => (
                      <li key={g}>{goalLabels[g]}</li>
                    ))}
                  </ul>
                  <Button asChild className="mt-5">
                    <Link to={destination(profile)}>
                      Continue to{' '}
                      {profile?.role === 'ADMIN'
                        ? 'admin dashboard'
                        : 'dashboard'}
                    </Link>
                  </Button>
                </div>
              )}
              <FormErrors errors={errors} />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {step < 4 && (
                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={step === 0 || saving}
                    onClick={() => {
                      setError('');
                      setStep((s) => s - 1);
                    }}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving
                      ? 'Saving...'
                      : step === 3
                        ? 'Save and finish'
                        : 'Save and continue'}
                  </Button>
                </div>
              )}
            </form>
          </motion.div>
        </CardContent>
      </Card>
    </main>
  );
}
