import { z } from 'zod';
import { categorySchema } from './assessments.js';
import type { Recommendation } from './assessments.js';

/** Presets include today in the saved preference timezone. Maximum: 366 days. */
export const analyticsQuerySchema = z
  .object({
    range: z.enum(['7d', '30d', '90d']).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    category: categorySchema.optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((v, ctx) => {
    if (!!v.startDate !== !!v.endDate || (v.range && v.startDate))
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a preset or both custom dates.',
      });
    if (v.startDate && v.endDate) {
      const days = (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000;
      if (
        days < 0 ||
        days > 365 ||
        v.startDate < '2000-01-01' ||
        v.endDate > '2100-12-31'
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'Choose an ordered range of at most 366 days between 2000 and 2100.',
        });
    }
  });
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
export interface ReportingPeriod {
  startDate: string;
  endDate: string;
  timezone: string;
}
export interface DailyCount {
  date: string;
  count: number;
}
export interface CategoryCount {
  category: string;
  count: number;
}
export interface AssessmentPoint {
  id: string;
  assessmentId: string;
  title: string;
  category: string;
  date: string;
  score: number;
  feedback: string;
  explanation: string;
  compatibilityKey: string;
  version: number;
}
export interface AssessmentSeries {
  assessmentId: string;
  title: string;
  category: string;
  compatibilityKey: string;
  points: AssessmentPoint[];
}
export interface AnalyticsEvent {
  id: string;
  kind: 'assessment' | 'activity';
  title: string;
  category: string;
  date: string;
  durationSeconds: number | null;
}
export interface AnalyticsPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface GoalPeriod {
  date: string;
  count: number;
  target: number;
  met: boolean;
  paused: boolean;
}
export interface GoalInsight {
  id: string;
  title: string;
  status: string;
  period: 'DAILY' | 'WEEKLY';
  timezone: string;
  count: number;
  target: number;
  percentage: number;
  periodStart: string;
  periodEnd: string;
  currentStreak: number;
  longestStreak: number;
  streakUnit: 'days' | 'weeks';
  history: GoalPeriod[];
}
export interface GoalAnalytics {
  rows: GoalInsight[];
  active: number;
  achieved: number;
  pending: number;
  completionPercentage: number;
}
export interface StreakSummary {
  current: number;
  longest: number;
  unit: 'days' | 'weeks';
  goalId: string | null;
  goalTitle: string | null;
}
export interface AnalyticsOverview {
  assessments: number;
  activities: number;
  activeGoals: number;
  goalCompletionPercentage: number;
}
export interface PersonalAnalytics {
  period: ReportingPeriod;
  generatedAt: string;
  fullName: string;
  overview: AnalyticsOverview;
  daily: DailyCount[];
  distribution: CategoryCount[];
  assessments: AssessmentSeries[];
  assessmentHistory: AnalyticsPage<AssessmentPoint>;
  goals: GoalAnalytics;
  streak: StreakSummary;
  timeline: AnalyticsPage<AnalyticsEvent>;
}
export interface DashboardSummary {
  period: ReportingPeriod;
  latestAssessment: AssessmentPoint | null;
  todayActivities: {
    completed: number;
    target: number | null;
    plannedCompleted: number;
  };
  activeGoals: number;
  achievedGoals: number;
  streak: StreakSummary;
}
export interface WellnessReportData extends PersonalAnalytics {
  recommendations: Recommendation[];
}
export interface SuppressedCount {
  value: number | null;
  suppressed: boolean;
}
export interface AdminBucket {
  label: string;
  value: number | null;
  suppressed: boolean;
}
export interface AdminAnalytics {
  period: ReportingPeriod;
  suppressionThreshold: number;
  activeUserDefinition: string;
  overview: {
    users: number;
    activeUsers: SuppressedCount;
    assessments: SuppressedCount;
    activities: SuppressedCount;
    publishedArticles: number;
    activeActivities: number;
  };
  users: AdminBucket[];
  assessments: AdminBucket[];
  activities: AdminBucket[];
  content: AdminBucket[];
  engagement: AdminBucket[];
}

const nonnegative = z.number().int().nonnegative();
export const reportingPeriodSchema = z.object({
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  timezone: z.string(),
});
export const assessmentPointSchema = z.object({
  id: z.string(),
  assessmentId: z.string(),
  title: z.string(),
  category: z.string(),
  date: z.string(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  explanation: z.string(),
  compatibilityKey: z.string(),
  version: nonnegative,
});
export const assessmentSeriesSchema = z.object({
  assessmentId: z.string(),
  title: z.string(),
  category: z.string(),
  compatibilityKey: z.string(),
  points: z.array(assessmentPointSchema),
});
export const goalInsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  period: z.enum(['DAILY', 'WEEKLY']),
  timezone: z.string(),
  count: nonnegative,
  target: nonnegative,
  percentage: z.number().min(0).max(100),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  currentStreak: nonnegative,
  longestStreak: nonnegative,
  streakUnit: z.enum(['days', 'weeks']),
  history: z.array(
    z.object({
      date: z.iso.date(),
      count: nonnegative,
      target: nonnegative,
      met: z.boolean(),
      paused: z.boolean(),
    }),
  ),
});
export const goalAnalyticsSchema = z.object({
  rows: z.array(goalInsightSchema),
  active: nonnegative,
  achieved: nonnegative,
  pending: nonnegative,
  completionPercentage: z.number().min(0).max(100),
});
export const streakSummarySchema = z.object({
  current: nonnegative,
  longest: nonnegative,
  unit: z.enum(['days', 'weeks']),
  goalId: z.string().nullable(),
  goalTitle: z.string().nullable(),
});
export const analyticsEventSchema = z.object({
  id: z.string(),
  kind: z.enum(['assessment', 'activity']),
  title: z.string(),
  category: z.string(),
  date: z.string(),
  durationSeconds: nonnegative.nullable(),
});
const pageFields = {
  total: nonnegative,
  page: nonnegative,
  pageSize: nonnegative,
};
export const personalAnalyticsSchema = z.object({
  period: reportingPeriodSchema,
  generatedAt: z.string(),
  fullName: z.string(),
  overview: z.object({
    assessments: nonnegative,
    activities: nonnegative,
    activeGoals: nonnegative,
    goalCompletionPercentage: z.number().min(0).max(100),
  }),
  daily: z.array(z.object({ date: z.iso.date(), count: nonnegative })),
  distribution: z.array(z.object({ category: z.string(), count: nonnegative })),
  assessments: z.array(assessmentSeriesSchema),
  assessmentHistory: z.object({
    ...pageFields,
    rows: z.array(assessmentPointSchema),
  }),
  goals: goalAnalyticsSchema,
  streak: streakSummarySchema,
  timeline: z.object({ ...pageFields, rows: z.array(analyticsEventSchema) }),
});
export const dashboardSummarySchema = z.object({
  period: reportingPeriodSchema,
  latestAssessment: assessmentPointSchema.nullable(),
  todayActivities: z.object({
    completed: nonnegative,
    target: nonnegative.nullable(),
    plannedCompleted: nonnegative,
  }),
  activeGoals: nonnegative,
  achievedGoals: nonnegative,
  streak: streakSummarySchema,
});
const suppressedCountSchema = z.object({
  value: nonnegative.nullable(),
  suppressed: z.boolean(),
});
const adminBucketSchema = suppressedCountSchema.extend({ label: z.string() });
export const adminAnalyticsSchema = z.object({
  period: reportingPeriodSchema,
  suppressionThreshold: nonnegative,
  activeUserDefinition: z.string(),
  overview: z.object({
    users: nonnegative,
    activeUsers: suppressedCountSchema,
    assessments: suppressedCountSchema,
    activities: suppressedCountSchema,
    publishedArticles: nonnegative,
    activeActivities: nonnegative,
  }),
  users: z.array(adminBucketSchema),
  assessments: z.array(adminBucketSchema),
  activities: z.array(adminBucketSchema),
  content: z.array(adminBucketSchema),
  engagement: z.array(adminBucketSchema),
});
export const wellnessReportDataSchema = personalAnalyticsSchema.extend({
  recommendations: z.array(
    z.object({
      id: z.string(),
      user_id: z.string(),
      rule_id: z.string(),
      rule_revision: nonnegative,
      assessment_attempt_id: z.string().nullable(),
      status: z.enum(['active', 'completed', 'dismissed']),
      activity_id: z.string().nullable().optional(),
      created_at: z.string(),
      updated_at: z.string(),
      content_snapshot: z.object({
        rule_id: z.string(),
        rule_revision: nonnegative,
        title: z.string(),
        description: z.string(),
        type: categorySchema,
        priority: z.number().int().min(1).max(3),
        why: z.string(),
      }),
    }),
  ),
});
