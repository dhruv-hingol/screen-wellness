import { z } from 'zod';

const labels: Record<string, string> = {
  full_name: 'full name',
  fullName: 'full name',
  confirmPassword: 'password confirmation',
  daily_screen_hours: 'daily screen time',
  primary_device: 'primary device',
  usage_purpose: 'main device use',
  break_frequency: 'break frequency',
  age_range: 'age range',
  goals: 'wellness goals',
  activity_ids: 'activities',
  target_count: 'target count',
  start_date: 'start date',
  end_date: 'end date',
  startDate: 'start date',
  endDate: 'end date',
  sleep_time: 'sleep time',
  wake_time: 'wake time',
  duration_seconds: 'duration in seconds',
  estimated_minutes: 'estimated minutes',
  interval_minutes: 'reminder interval',
  days_of_week: 'reminder days',
  category_id: 'article category',
  recommendation_type: 'recommendation category',
  recommendation_title: 'recommendation title',
  recommendation_description: 'recommendation description',
  rule_name: 'rule name',
  assessment_id: 'assessment',
  question_text: 'question',
  option_text: 'answer option',
  optionId: 'answer option',
  questionId: 'question',
  min: 'minimum score',
  max: 'maximum score',
  compatibilityKey: 'scoring group',
  scoring_config: 'scoring settings',
  cover_image_path: 'cover image',
  editorial_reviewed: 'editorial review',
  is_active: 'active status',
};
export function fieldLabel(path: readonly PropertyKey[] | string) {
  const parts = typeof path === 'string' ? path.split('.') : path.map(String);
  const key = parts.filter((p) => !/^\d+$/.test(p)).at(-1) ?? '';
  return (
    labels[key] ||
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replaceAll('_', ' ')
      .toLowerCase() ||
    'this field'
  );
}
export interface ValidationIssueLike {
  code?: string;
  path?: readonly PropertyKey[];
  message?: string;
  expected?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  origin?: string;
  format?: string;
}
export function validationIssueMessage(issue: ValidationIssueLike) {
  if (issue.message) return issue.message;
  const field = fieldLabel(issue.path ?? []);
  if (issue.code === 'invalid_type')
    return issue.expected === 'number'
      ? `Enter a valid number for ${field}.`
      : `Enter ${field}.`;
  if (issue.code === 'invalid_value')
    return `Choose a valid option for ${field}.`;
  if (issue.code === 'too_small') {
    if (issue.origin === 'string')
      return Number(issue.minimum) === 1
        ? `Enter ${field}.`
        : `Use at least ${issue.minimum} characters for ${field}.`;
    if (issue.origin === 'array')
      return `Choose at least ${issue.minimum} item${Number(issue.minimum) === 1 ? '' : 's'} for ${field}.`;
    return `Enter ${issue.minimum} or more for ${field}.`;
  }
  if (issue.code === 'too_big') {
    if (issue.origin === 'string')
      return `Keep ${field} to ${issue.maximum} characters or fewer.`;
    if (issue.origin === 'array')
      return `Choose no more than ${issue.maximum} items for ${field}.`;
    return `Enter ${issue.maximum} or less for ${field}.`;
  }
  if (issue.code === 'invalid_format') {
    if (field === 'slug')
      return 'Use lowercase letters, numbers and single hyphens for the slug.';
    if (issue.format === 'email') return 'Enter a valid email address.';
    if (issue.format === 'url') return 'Enter a valid web address.';
    if (issue.format === 'date') return `Enter a valid date for ${field}.`;
    return `Check the format of ${field}.`;
  }
  if (issue.code === 'unrecognized_keys')
    return 'This form contains unsupported fields. Reload the page and try again.';
  if (issue.code === 'invalid_union') return `Check the value for ${field}.`;
  return `Check ${field} and try again.`;
}
// Schema-specific instructions keep priority; this replaces technical defaults
// everywhere the shared package and its Zod instance are used.
z.config({ customError: (issue) => validationIssueMessage(issue) });
