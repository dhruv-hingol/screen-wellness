import { z } from 'zod';
import { goalKeySchema, type GoalKey } from './users.js';
export const assessmentCategories = [
  'EYE_COMFORT',
  'POSTURE',
  'SLEEP',
  'DIGITAL_FATIGUE',
] as const;
export const categorySchema = z.enum(assessmentCategories);
export const feedbackLabels = [
  'Lower reported concern',
  'Moderate reported concern',
  'Higher reported concern',
] as const;
export const scoringConfigSchema = z
  .strictObject({
    compatibilityKey: z.string().trim().min(1).max(100),
    bands: z
      .array(
        z.strictObject({
          min: z.number().min(0).max(100),
          label: z.enum(feedbackLabels),
          explanation: z.string().trim().min(1).max(1500),
        }),
      )
      .length(3),
  })
  .superRefine((v, ctx) => {
    if (
      v.bands[0]?.min !== 0 ||
      v.bands.some((b, i) => i > 0 && b.min <= v.bands[i - 1]!.min) ||
      new Set(v.bands.map((b) => b.label)).size !== 3
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use three unique, increasing feedback bands starting at 0.',
      });
  });
export type ScoringConfig = z.infer<typeof scoringConfigSchema>;
export const optionInputSchema = z.strictObject({
  id: z.uuid(),
  option_text: z.string().trim().min(1).max(300),
  score: z.number().int().min(0).max(100),
});
export const questionInputSchema = z.strictObject({
  id: z.uuid(),
  question_text: z.string().trim().min(1).max(1000),
  question_type: z.literal('single_choice'),
  is_required: z.boolean(),
  options: z.array(optionInputSchema).min(2).max(10),
});
export const definitionSchema = z
  .strictObject({
    scoring_config: scoringConfigSchema,
    questions: z.array(questionInputSchema).min(1).max(50),
  })
  .superRefine((v, ctx) => {
    const ids = [
      ...v.questions.map((q) => q.id),
      ...v.questions.flatMap((q) => q.options.map((o) => o.id)),
    ];
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Question and option IDs must be unique.',
      });
    if (!v.questions.some((q) => q.is_required))
      ctx.addIssue({
        code: 'custom',
        message: 'At least one required question is needed.',
      });
  });
export const metadataSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(100),
  description: z.string().trim().min(10).max(2000),
  category: categorySchema,
  estimated_minutes: z.number().int().min(1).max(60),
});
export const draftSaveSchema = z
  .strictObject({
    revision: z.number().int().min(0),
    ...definitionSchema.shape,
  })
  .superRefine((v, ctx) => {
    const parsed = definitionSchema.safeParse({
      questions: v.questions,
      scoring_config: v.scoring_config,
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues)
        ctx.addIssue({
          code: 'custom',
          path: issue.path,
          message: issue.message,
        });
  });
export const submissionSchema = z
  .strictObject({
    assessmentVersionId: z.uuid(),
    idempotencyKey: z.uuid(),
    responses: z
      .array(
        z.strictObject({ questionId: z.uuid(), selectedOptionId: z.uuid() }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((v, ctx) => {
    if (
      new Set(v.responses.map((r) => r.questionId)).size !== v.responses.length
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Only one response per question is allowed.',
      });
  });
export const atomicConditionSchema = z.discriminatedUnion('field', [
  z.strictObject({ field: z.literal('category'), value: categorySchema }),
  z
    .strictObject({
      field: z.literal('score'),
      min: z.number().min(0).max(100),
      max: z.number().min(0).max(100),
    })
    .refine((v) => v.max >= v.min, 'Maximum must be at least minimum'),
  z.strictObject({
    field: z.literal('feedback'),
    value: z.enum(feedbackLabels),
  }),
  z.strictObject({
    field: z.literal('answer'),
    questionId: z.uuid(),
    optionId: z.uuid(),
  }),
  z.strictObject({ field: z.literal('goal'), value: goalKeySchema }),
]);
export const conditionSchema = z.strictObject({
  mode: z.enum(['all', 'any']),
  conditions: z.array(atomicConditionSchema).min(1).max(12),
});
export const ruleInputSchema = z.strictObject({
  activity_id: z.uuid().nullable().optional(),
  assessment_id: z.uuid().nullable(),
  rule_name: z.string().trim().min(3).max(150),
  conditions: conditionSchema,
  recommendation_title: z.string().trim().min(3).max(150),
  recommendation_description: z.string().trim().min(10).max(2000),
  recommendation_type: categorySchema,
  priority: z.number().int().min(1).max(3),
  is_active: z.boolean(),
});
export const recommendationStatusSchema = z.strictObject({
  status: z.enum(['active', 'completed', 'dismissed']),
});
export const assessmentQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    search: z.string().trim().max(100).default(''),
    category: categorySchema.optional(),
    assessmentId: z.uuid().optional(),
    activityId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    status: z
      .enum([
        'draft',
        'published',
        'archived',
        'active',
        'completed',
        'dismissed',
      ])
      .optional(),
  })
  .refine(
    (v) => !v.from || !v.to || v.to >= v.from,
    'End date must follow start date',
  );
export type AssessmentQuery = z.infer<typeof assessmentQuerySchema>;
export type AssessmentMetadata = z.infer<typeof metadataSchema>;
export type Definition = z.infer<typeof definitionSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export type RuleInput = z.infer<typeof ruleInputSchema>;
export type Conditions = z.infer<typeof conditionSchema>;
export interface Option {
  id: string;
  option_text: string;
  display_order: number;
  score?: number;
}
export interface Question {
  id: string;
  question_text: string;
  question_type: 'single_choice';
  is_required: boolean;
  display_order: number;
  options: Option[];
}
export interface Version {
  id: string;
  assessment_id: string;
  version_number: number;
  status: 'draft' | 'published' | 'archived';
  scoring_config: ScoringConfig;
  draft_revision: number;
  questions: Question[];
}
export interface Assessment extends AssessmentMetadata {
  id: string;
  status: 'draft' | 'published' | 'archived';
  created_at: string;
  updated_at: string;
  question_count?: number;
  latest_attempt?: Attempt | null;
  version?: Omit<Version, 'scoring_config'>;
  versions?: Version[];
}
export interface ScoreResult {
  total_score: number;
  normalized_score: number;
  minimum_score: number;
  maximum_score: number;
  feedback_category: string;
  explanation: string;
  compatibility_key: string;
}
export interface Attempt extends ScoreResult {
  id: string;
  user_id: string;
  assessment_id: string;
  assessment_version_id: string;
  submitted_at: string;
  assessment_title: string;
  category: (typeof assessmentCategories)[number];
  version_number: number;
  result_snapshot: {
    assessment: AssessmentMetadata;
    scoring_config: ScoringConfig;
    questions: Question[];
    recommendations: RecommendationSuggestion[];
  };
  responses?: { question_id: string; selected_option_id: string }[];
  recommendations?: Recommendation[];
}
export interface Rule extends RuleInput {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
}
export interface RecommendationSuggestion {
  rule_id: string;
  rule_revision: number;
  title: string;
  description: string;
  type: (typeof assessmentCategories)[number];
  priority: number;
  why: string;
}
export interface Recommendation {
  activity_title?: string | null;
  activity_id?: string | null;
  id: string;
  user_id: string;
  rule_id: string;
  rule_revision: number;
  assessment_attempt_id: string | null;
  status: 'active' | 'completed' | 'dismissed';
  content_snapshot: RecommendationSuggestion;
  created_at: string;
  updated_at: string;
}
export interface Page<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
export interface TrendGroup {
  compatibilityKey: string;
  versionNumbers: number[];
  points: {
    id: string;
    submitted_at: string;
    normalized_score: number;
    version_number: number;
  }[];
}
export interface RuleContext {
  category: (typeof assessmentCategories)[number];
  score: number;
  feedback: string;
  responses: Submission['responses'];
  goals: GoalKey[];
}
