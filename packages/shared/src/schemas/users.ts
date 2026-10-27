import { timezoneSchema } from './wellness.js';
import { z } from 'zod';
export const occupations = [
  'Student',
  'Working Professional',
  'Other',
] as const;
export const ageRanges = [
  'Under 18',
  '18-24',
  '25-34',
  '35-44',
  '45+',
] as const;
export const devices = [
  'Smartphone',
  'Laptop',
  'Desktop',
  'Tablet',
  'Other',
] as const;
export const purposes = [
  'Study',
  'Work',
  'Entertainment',
  'Social connection',
  'Mixed',
] as const;
export const breaks = [
  'Every 20 minutes',
  'Every hour',
  'Every few hours',
  'Rarely',
] as const;
export const goalLabels = {
  eye_comfort: 'Reduce eye discomfort',
  posture: 'Improve posture habits',
  sleep: 'Build better sleep routines',
  screen_breaks: 'Take more screen breaks',
  digital_fatigue: 'Reduce digital fatigue',
  overall_wellness: 'Improve overall digital wellness',
} as const;
export const goalKeySchema = z.enum([
  'eye_comfort',
  'posture',
  'sleep',
  'screen_breaks',
  'digital_fatigue',
  'overall_wellness',
]);
export const goalsSchema = z
  .array(goalKeySchema)
  .max(6)
  .refine((v) => new Set(v).size === v.length, 'Select each goal only once');
export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter at least 2 characters')
  .max(100);
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol');
export const signupSchema = z
  .object({
    fullName: fullNameSchema,
    email: z.email(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, 'Enter your password'),
});
export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Use a valid time');
export const profilePatchSchema = z
  .strictObject({
    full_name: fullNameSchema.optional(),
    occupation: z.enum(occupations).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide a field to update');
export const preferencesPatchSchema = z
  .strictObject({
    age_range: z.enum(ageRanges).nullable().optional(),
    primary_device: z.enum(devices).nullable().optional(),
    daily_screen_hours: z.number().min(0).max(24).nullable().optional(),
    usage_purpose: z.enum(purposes).nullable().optional(),
    sleep_time: time.nullable().optional(),
    wake_time: time.nullable().optional(),
    break_frequency: z.enum(breaks).nullable().optional(),
    timezone: timezoneSchema.optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    notifications_enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Provide a field to update');
export const onboardingSchema = z.strictObject({
  full_name: fullNameSchema,
  occupation: z.enum(occupations),
  age_range: z.enum(ageRanges).nullable(),
  primary_device: z.enum(devices),
  daily_screen_hours: z.number().min(0).max(24),
  usage_purpose: z.enum(purposes),
  break_frequency: z.enum(breaks),
  sleep_time: time.nullable(),
  wake_time: time.nullable(),
  goals: goalsSchema.min(1, 'Choose at least one goal'),
});
export const goalsBodySchema = z.strictObject({ goals: goalsSchema });
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type PreferencesPatch = z.infer<typeof preferencesPatchSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type GoalKey = z.infer<typeof goalKeySchema>;
export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: 'USER' | 'ADMIN';
  avatar_url: string | null;
  occupation: (typeof occupations)[number] | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}
export interface UserPreferences {
  timezone?: string;
  id: string;
  user_id: string;
  age_range: (typeof ageRanges)[number] | null;
  primary_device: (typeof devices)[number] | null;
  daily_screen_hours: number | null;
  usage_purpose: (typeof purposes)[number] | null;
  sleep_time: string | null;
  wake_time: string | null;
  break_frequency: (typeof breaks)[number] | null;
  theme: 'light' | 'dark' | 'system';
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}
export interface OnboardingData {
  profile: UserProfile;
  preferences: UserPreferences;
  goals: GoalKey[];
}
