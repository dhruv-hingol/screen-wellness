import { createHash } from 'node:crypto';
import {
  definitionSchema,
  scoringConfigSchema,
  type Version,
  type Submission,
  type ScoreResult,
  type Rule,
  type RuleContext,
  type RecommendationSuggestion,
} from '@screenwise/shared';
import { AppError } from '../../utils/app-error.js';
export function scoreAssessment(
  version: Version,
  responses: Submission['responses'],
): ScoreResult {
  const valid = definitionSchema.safeParse({
    scoring_config: version.scoring_config,
    questions: version.questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      is_required: q.is_required,
      options: q.options.map((o) => ({
        id: o.id,
        option_text: o.option_text,
        score: o.score,
      })),
    })),
  });
  if (!valid.success)
    throw new AppError(
      409,
      'INVALID_DEFINITION',
      'This assessment needs administrator review.',
    );
  if (new Set(responses.map((r) => r.questionId)).size !== responses.length)
    throw new AppError(400, 'DUPLICATE_RESPONSE', 'Answer each question once.');
  const questionMap = new Map(version.questions.map((q) => [q.id, q]));
  const selected = new Map(
    responses.map((r) => [r.questionId, r.selectedOptionId]),
  );
  for (const response of responses) {
    const q = questionMap.get(response.questionId);
    if (!q || !q.options.some((o) => o.id === response.selectedOptionId))
      throw new AppError(
        400,
        'INVALID_RESPONSE',
        'An answer does not belong to this assessment version.',
      );
  }
  let total = 0,
    min = 0,
    max = 0;
  for (const q of version.questions) {
    const answer = selected.get(q.id);
    if (!answer && q.is_required)
      throw new AppError(
        400,
        'MISSING_RESPONSE',
        'Please answer all required questions.',
      );
    if (!answer) continue;
    const scores = q.options.map((o) => o.score!);
    min += Math.min(...scores);
    max += Math.max(...scores);
    total += q.options.find((o) => o.id === answer)!.score!;
  }
  const normalized =
    max === min ? 0 : Math.round(((total - min) / (max - min)) * 10000) / 100;
  const config = scoringConfigSchema.parse(version.scoring_config);
  const band = [...config.bands].reverse().find((b) => normalized >= b.min)!;
  return {
    total_score: total,
    normalized_score: normalized,
    minimum_score: min,
    maximum_score: max,
    feedback_category: band.label,
    explanation: band.explanation,
    compatibility_key: version.questions.some((q) => !q.is_required)
      ? config.compatibilityKey +
        ':' +
        createHash('sha256')
          .update(
            JSON.stringify(
              version.questions.map((q, i) =>
                !q.is_required && selected.has(q.id) ? i : null,
              ),
            ),
          )
          .digest('hex')
      : config.compatibilityKey,
  };
}
export function evaluateRule(
  rule: Rule,
  context: RuleContext,
): RecommendationSuggestion | null {
  const matches = rule.conditions.conditions.map((c) => {
    switch (c.field) {
      case 'category':
        return context.category === c.value;
      case 'score':
        return context.score >= c.min && context.score <= c.max;
      case 'feedback':
        return context.feedback === c.value;
      case 'answer':
        return context.responses.some(
          (r) =>
            r.questionId === c.questionId && r.selectedOptionId === c.optionId,
        );
      case 'goal':
        return context.goals.includes(c.value);
    }
  });
  if (
    !rule.is_active ||
    !(rule.conditions.mode === 'all'
      ? matches.every(Boolean)
      : matches.some(Boolean))
  )
    return null;
  const matched = rule.conditions.conditions
    .filter((_, i) => matches[i])
    .map((c) =>
      c.field === 'score'
        ? 'your reported concern score'
        : c.field === 'goal'
          ? 'a wellness interest you selected'
          : c.field === 'answer'
            ? 'an answer you provided'
            : c.field === 'feedback'
              ? 'your educational feedback group'
              : 'the assessment topic',
    );
  return {
    rule_id: rule.id,
    rule_revision: rule.revision,
    title: rule.recommendation_title,
    description: rule.recommendation_description,
    type: rule.recommendation_type,
    priority: rule.priority,
    why: 'Suggested because of ' + [...new Set(matched)].join(' and ') + '.',
  };
}
