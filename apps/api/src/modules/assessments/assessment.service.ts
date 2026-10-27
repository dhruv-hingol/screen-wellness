import { createHash, randomUUID } from 'node:crypto';
import {
  definitionSchema,
  conditionSchema,
  type AssessmentQuery,
  type Submission,
  type Definition,
  type RuleInput,
  type RecommendationSuggestion,
  type Question,
  type AssessmentMetadata,
  type Version,
  type TrendGroup,
} from '@screenwise/shared';
import { AssessmentRepository } from './assessment.repository.js';
import { scoreAssessment, evaluateRule } from './scoring.service.js';
import { AppError } from '../../utils/app-error.js';
const hash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
function publicVersion(v: Version) {
  return {
    id: v.id,
    assessment_id: v.assessment_id,
    version_number: v.version_number,
    status: v.status,
    draft_revision: v.draft_revision,
    questions: v.questions.map((q) => ({
      ...q,
      options: q.options.map(({ id, option_text, display_order }) => ({
        id,
        option_text,
        display_order,
      })),
    })),
  };
}
export class AssessmentService {
  constructor(private repo: AssessmentRepository) {}
  async list(query: AssessmentQuery, admin = false) {
    const result = await this.repo.list(query, admin);
    const rows = await Promise.all(
      result.rows.map(async (t) => {
        const versions = await this.repo.versions(t.id);
        const v = versions.find((v) => v.status === 'published');
        const recent = admin
          ? null
          : ((
              await this.repo.attempts({ ...query, page: 1, pageSize: 1 }, t.id)
            ).rows[0] ?? null);
        return {
          ...t,
          question_count: v?.questions.length ?? 0,
          latest_attempt: recent,
        };
      }),
    );
    return { rows, total: result.total };
  }
  async detail(id: string, admin = false) {
    const t = await this.repo.type(id, admin);
    const versions = await this.repo.versions(id);
    if (admin) return { ...t, versions };
    const v = versions.find((v) => v.status === 'published');
    if (!v)
      throw new AppError(
        404,
        'NOT_FOUND',
        'No published questionnaire is available.',
      );
    return { ...t, version: publicVersion(v) };
  }
  async result(id: string) {
    const attempt = await this.repo.attempt(id);
    const [responses, recommendations] = await Promise.all([
      this.repo.responses(id),
      this.repo.recommendations(),
    ]);
    const matches = new Set(
      attempt.result_snapshot.recommendations.map(
        (r) => r.rule_id + ':' + r.rule_revision,
      ),
    );
    return {
      ...attempt,
      responses,
      recommendations: recommendations.rows.filter((r) =>
        matches.has(r.rule_id + ':' + r.rule_revision),
      ),
    };
  }
  async submit(id: string, input: Submission) {
    const requestHash = hash({
      id,
      version: input.assessmentVersionId,
      responses: [...input.responses].sort((a, b) =>
        a.questionId.localeCompare(b.questionId),
      ),
    });
    const prior = await this.repo.prior(input.idempotencyKey);
    if (prior) {
      if (prior.request_hash !== requestHash)
        throw new AppError(
          409,
          'CONFLICT',
          'Submission key already used for different answers.',
        );
      return this.result(prior.id);
    }
    const assessment = await this.repo.type(id);
    const v = (await this.repo.versions(id)).find(
      (v) => v.id === input.assessmentVersionId && v.status === 'published',
    );
    if (!v)
      throw new AppError(
        409,
        'VERSION_UNAVAILABLE',
        'This questionnaire changed. Reload to start its latest version.',
      );
    const result = scoreAssessment(v, input.responses);
    result.compatibility_key = hash({
      category: assessment.category,
      key: result.compatibility_key,
    });
    const goals = await this.repo.goals();
    const rules = await this.repo.rules(id);
    const suggestions = rules
      .map((r) =>
        evaluateRule(
          { ...r, conditions: conditionSchema.parse(r.conditions) },
          {
            category: assessment.category,
            score: result.normalized_score,
            feedback: result.feedback_category,
            responses: input.responses,
            goals,
          },
        ),
      )
      .filter((r): r is RecommendationSuggestion => r !== null);
    const attemptId = await this.repo.submit({
      p_user_id: this.repo.userId,
      p_assessment_id: id,
      p_version_id: v.id,
      p_key: input.idempotencyKey,
      p_hash: requestHash,
      p_result: {
        ...result,
        result_snapshot: {
          assessment,
          scoring_config: v.scoring_config,
          questions: v.questions,
          recommendations: suggestions,
        },
      },
      p_responses: input.responses,
      p_recommendations: suggestions,
    });
    return this.result(attemptId);
  }
  history(query: AssessmentQuery) {
    return this.repo.attempts(query);
  }
  async trends(id: string) {
    await this.repo.type(id, true);
    const all = [];
    let page = 1;
    for (;;) {
      const result = await this.repo.attempts(
        { page, pageSize: 100, search: '' },
        id,
      );
      all.push(...result.rows);
      if (all.length >= result.total) break;
      page++;
    }
    const groups = new Map<string, TrendGroup>();
    for (const a of all.reverse()) {
      const key = a.compatibility_key;
      const g = groups.get(key) ?? {
        compatibilityKey: key,
        versionNumbers: [],
        points: [],
      };
      if (!g.versionNumbers.includes(a.version_number))
        g.versionNumbers.push(a.version_number);
      g.points.push({
        id: a.id,
        submitted_at: a.submitted_at,
        normalized_score: a.normalized_score,
        version_number: a.version_number,
      });
      groups.set(key, g);
    }
    return [...groups.values()];
  }
  recommendations(query: AssessmentQuery) {
    return this.repo.recommendations(query);
  }
  updateRecommendation(id: string, status: string) {
    return this.repo.updateRecommendation(id, status);
  }
  async refresh() {
    const history = [];
    let page = 1;
    for (;;) {
      const r = await this.repo.attempts({ page, pageSize: 100, search: '' });
      history.push(...r.rows);
      if (history.length >= r.total) break;
      page++;
    }
    const latest = new Map(history.map((a) => [a.assessment_id, a]));
    for (const a of history)
      if (
        !latest.has(a.assessment_id) ||
        latest.get(a.assessment_id)!.submitted_at < a.submitted_at
      )
        latest.set(a.assessment_id, a);
    const goals = await this.repo.goals();
    for (const a of latest.values()) {
      const responses = (await this.repo.responses(a.id)).map((r) => ({
        questionId: r.question_id,
        selectedOptionId: r.selected_option_id,
      }));
      const suggestions = (await this.repo.rules(a.assessment_id))
        .map((r) =>
          evaluateRule(
            { ...r, conditions: conditionSchema.parse(r.conditions) },
            {
              category: a.category,
              score: a.normalized_score,
              feedback: a.feedback_category,
              responses,
              goals,
            },
          ),
        )
        .filter((r): r is RecommendationSuggestion => r !== null);
      await this.repo.storeRecommendations(a.id, suggestions);
    }
    return { evaluatedAssessments: latest.size };
  }
  async create(input: AssessmentMetadata) {
    const t = await this.repo.createType(input);
    await this.repo.draft(t.id);
    return this.detail(t.id, true);
  }
  metadata(id: string, input: Partial<AssessmentMetadata>) {
    return this.repo.metadata(id, input);
  }
  archive(id: string) {
    return this.repo.archive(id);
  }
  async draft(id: string) {
    await this.repo.type(id, true);
    const previous = (await this.repo.versions(id)).find(
      (v) => v.status !== 'draft',
    );
    const existing = (await this.repo.versions(id)).find(
      (v) => v.status === 'draft',
    );
    if (existing) return this.detail(id, true);
    await this.repo.draft(id);
    if (previous) {
      const next = (await this.repo.versions(id)).find(
        (v) => v.status === 'draft',
      )!;
      const questions = previous.questions.map((q) => ({
        id: randomUUID(),
        question_text: q.question_text,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.options.map((o) => ({
          id: randomUUID(),
          option_text: o.option_text,
          score: o.score!,
        })),
      }));
      await this.repo.saveDraft(id, next, {
        scoring_config: previous.scoring_config,
        questions,
      });
    }
    return this.detail(id, true);
  }
  async save(id: string, revision: number, definition: Definition) {
    const v = (await this.repo.versions(id)).find((v) => v.status === 'draft');
    if (!v || v.draft_revision !== revision)
      throw new AppError(
        409,
        'CONFLICT',
        'Draft changed. Reload before saving.',
      );
    const parsed = definitionSchema.parse(definition);
    await this.repo.saveDraft(id, v, parsed);
    return this.detail(id, true);
  }
  async publish(id: string, revision: number) {
    const t = await this.repo.type(id, true);
    const v = (await this.repo.versions(id)).find((v) => v.status === 'draft');
    if (!v || v.draft_revision !== revision)
      throw new AppError(
        409,
        'CONFLICT',
        'Draft changed. Reload before publishing.',
      );
    const def = definitionSchema.parse({
      scoring_config: v.scoring_config,
      questions: v.questions.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.options.map((o) => ({
          id: o.id,
          option_text: o.option_text,
          score: o.score!,
        })),
      })),
    });
    const compatibilityKey = hash({
      category: t.category,
      questions: def.questions.map((q) => ({
        text: q.question_text,
        required: q.is_required,
        options: q.options.map((o) => ({
          text: o.option_text,
          score: o.score,
        })),
      })),
      bands: def.scoring_config.bands,
    });
    await this.repo.saveDraft(id, v, {
      ...def,
      scoring_config: { ...def.scoring_config, compatibilityKey },
    });
    await this.repo.publish(id, { ...v, draft_revision: revision + 1 });
    return this.detail(id, true);
  }
  async editQuestion(
    id: string,
    questionId: string | undefined,
    input: Omit<Question, 'options'> & {
      options: { id: string; option_text: string; score: number }[];
    },
  ) {
    const v = (await this.repo.versions(id)).find((v) => v.status === 'draft');
    if (!v)
      throw new AppError(
        409,
        'DRAFT_REQUIRED',
        'Create a draft version first.',
      );
    const questions = v.questions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      is_required: q.is_required,
      options: q.options.map((o) => ({
        id: o.id,
        option_text: o.option_text,
        score: o.score!,
      })),
    }));
    const replacement = {
      id: questionId ?? input.id,
      question_text: input.question_text,
      question_type: input.question_type,
      is_required: input.is_required,
      options: input.options.map((o) => ({
        id: o.id,
        option_text: o.option_text,
        score: o.score!,
      })),
    };
    const index = questions.findIndex((q) => q.id === questionId);
    if (questionId && index < 0)
      throw new AppError(404, 'NOT_FOUND', 'Draft question not found.');
    if (index < 0) questions.push(replacement);
    else questions[index] = replacement;
    return this.save(id, v.draft_revision, {
      scoring_config: v.scoring_config,
      questions,
    });
  }
  async rules(query: AssessmentQuery) {
    return this.repo.ruleList(query);
  }
  async saveRule(input: RuleInput, id?: string) {
    if (input.activity_id) await this.repo.linkedActivity(input.activity_id);
    if (input.assessment_id) await this.repo.type(input.assessment_id, true);
    for (const c of input.conditions.conditions)
      if (c.field === 'answer') {
        if (!input.assessment_id)
          throw new AppError(
            400,
            'INVALID_RULE',
            'Answer conditions must select an assessment.',
          );
        const versions = await this.repo.versions(input.assessment_id);
        if (
          !versions.some((v) =>
            v.questions.some(
              (q) =>
                q.id === c.questionId &&
                q.options.some((o) => o.id === c.optionId),
            ),
          )
        )
          throw new AppError(
            400,
            'INVALID_RULE',
            'Choose a question and option from the selected assessment.',
          );
      }
    return this.repo.saveRule(input as unknown as Record<string, unknown>, id);
  }
  async deactivateRule(id: string) {
    return this.repo.saveRule({ is_active: false }, id);
  }
}
