import { z } from 'zod';
export const activityCategories = [
  'EYE_COMFORT',
  'POSTURE',
  'MOVEMENT',
  'SLEEP',
  'DIGITAL_BREAK',
  'GENERAL',
] as const;
export const activityCategorySchema = z.enum(activityCategories);
export const timezoneSchema = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Choose a valid IANA timezone');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const activityInputSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  description: z.string().trim().min(10).max(2000),
  category: activityCategorySchema,
  duration_seconds: z.number().int().min(5).max(7200),
  instructions: z.array(z.string().trim().min(3).max(1000)).min(1).max(20),
  benefits: z.array(z.string().trim().min(3).max(300)).max(10),
  safety_notes: z.string().max(1000).nullable(),
  icon: z.string().max(60).nullable(),
  image_url: z
    .url()
    .refine((v) => v.startsWith('https://'), 'Use an HTTPS image URL')
    .nullable(),
  difficulty: z.enum(['EASY', 'MODERATE']),
  is_active: z.boolean(),
});
export const sessionStartSchema = z.strictObject({
  idempotencyKey: z.uuid(),
  source: z.enum(['MANUAL', 'CHECKLIST', 'TIMER']).default('MANUAL'),
});
export const sessionPatchSchema = z.strictObject({
  status: z.enum(['COMPLETED', 'CANCELLED']),
});
export const goalInputSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(150),
    description: z.string().max(1000).nullable(),
    category: activityCategorySchema,
    target_count: z.number().int().min(1).max(100),
    period: z.enum(['DAILY', 'WEEKLY']),
    start_date: z.iso
      .date()
      .refine(
        (v) => v >= '2000-01-01' && v <= '2100-12-31',
        'Use a date between 2000 and 2100',
      ),
    end_date: z.iso
      .date()
      .refine(
        (v) => v >= '2000-01-01' && v <= '2100-12-31',
        'Use a date between 2000 and 2100',
      )
      .nullable(),
    timezone: timezoneSchema,
    activity_ids: z
      .array(z.uuid())
      .min(1, 'Choose at least one activity to track this goal.')
      .max(30),
  })
  .refine((v) => !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'End date must follow start date',
  })
  .refine(
    (v) => new Set(v.activity_ids).size === v.activity_ids.length,
    'Select each activity once',
  );
export const goalStatusSchema = z.strictObject({
  status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
});
export const reminderTypes = [
  'EYE_BREAK',
  'POSTURE',
  'MOVEMENT',
  'DAILY_GOAL',
  'EVENING_ROUTINE',
] as const;
export const reminderInputSchema = z
  .strictObject({
    reminder_type: z.enum(reminderTypes),
    interval_minutes: z.number().int().min(5).max(240).nullable(),
    enabled: z.boolean(),
    start_time: clock,
    end_time: clock,
    days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    timezone: timezoneSchema,
  })
  .superRefine((v, ctx) => {
    if (v.end_time <= v.start_time)
      ctx.addIssue({
        code: 'custom',
        path: ['end_time'],
        message: 'End time must follow start time on the same day.',
      });
    if (v.reminder_type !== 'EVENING_ROUTINE' && v.interval_minutes === null)
      ctx.addIssue({
        code: 'custom',
        path: ['interval_minutes'],
        message: 'Choose a reminder interval.',
      });
    if (new Set(v.days_of_week).size !== v.days_of_week.length)
      ctx.addIssue({
        code: 'custom',
        path: ['days_of_week'],
        message: 'Select each day once.',
      });
  });
export const wellnessQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).default(''),
  category: activityCategorySchema.optional(),
  difficulty: z.enum(['EASY', 'MODERATE']).optional(),
  maxDuration: z.coerce.number().int().min(5).max(7200).optional(),
  date: z.iso.date().optional(),
  timezone: timezoneSchema.optional(),
  status: z
    .enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'STARTED', 'COMPLETED', 'CANCELLED'])
    .optional(),
  unread: z.enum(['true', 'false']).optional(),
});
export type WellnessQuery = z.infer<typeof wellnessQuerySchema>;
export type ActivityInput = z.infer<typeof activityInputSchema>;
export interface Activity extends ActivityInput {
  id: string;
  created_at: string;
  updated_at: string;
}
export interface ActivitySession {
  id: string;
  user_id: string;
  activity_id: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  status: 'STARTED' | 'COMPLETED' | 'CANCELLED';
  source: 'MANUAL' | 'CHECKLIST' | 'TIMER';
  activity_snapshot: Activity;
  checklist_date: string | null;
}
export type GoalInput = z.infer<typeof goalInputSchema>;
export interface WellnessGoal extends GoalInput {
  id: string;
  user_id: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  tracking_start: string;
  pause_ranges: { from: string; to: string | null }[];
  definition_history: unknown[];
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  progress?: GoalProgress;
}
export interface GoalProgress {
  count: number;
  target: number;
  percentage: number;
  periodStart: string;
  periodEnd: string;
  currentStreak: number;
  longestStreak: number;
  streakUnit: 'days' | 'weeks';
  history: {
    date: string;
    count: number;
    target: number;
    met: boolean;
    paused: boolean;
  }[];
}
export type ReminderInput = z.infer<typeof reminderInputSchema>;
export interface Reminder extends ReminderInput {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}
export interface WellnessNotification {
  id: string;
  title: string;
  message: string;
  type:
    | 'BREAK_REMINDER'
    | 'ACTIVITY_REMINDER'
    | 'GOAL_REMINDER'
    | 'WELLNESS_TIP'
    | 'SYSTEM';
  is_read: boolean;
  scheduled_for: string | null;
  created_at: string;
}
export interface DailyChecklist {
  recordedPlan: boolean;
  date: string;
  timezone: string;
  activities: Activity[];
  sessions: ActivitySession[];
  completedActivityIds: string[];
  goals: WellnessGoal[];
}
