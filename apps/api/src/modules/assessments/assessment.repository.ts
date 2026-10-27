import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Assessment,
  Version,
  Attempt,
  Rule,
  Recommendation,
  GoalKey,
  Definition,
  AssessmentMetadata,
  AssessmentQuery,
} from '@screenwise/shared';
import { getAdminClient } from '../../config/supabase.js';
import { AppError } from '../../utils/app-error.js';
export function checked<T>(result: {
  data: T;
  error: { code?: string } | null;
}): NonNullable<T> {
  if (result.error) {
    const c = result.error.code;
    if (c === '40001' || c === '23505')
      throw new AppError(
        409,
        'CONFLICT',
        'This record changed. Reload and try again.',
      );
    if (c === 'PGRST116')
      throw new AppError(404, 'NOT_FOUND', 'Record not found.');
    throw new AppError(
      503,
      'DATABASE_UNAVAILABLE',
      'Assessment data is unavailable. Confirm the Phase 2 and Phase 3 migrations are applied.',
    );
  }
  if (result.data === null)
    throw new AppError(404, 'NOT_FOUND', 'Record not found.');
  return result.data!;
}
export class AssessmentRepository {
  private db = getAdminClient();
  constructor(
    public userId: string,
    private scoped: SupabaseClient,
  ) {}
  async list(query: AssessmentQuery, admin = false) {
    let q = this.db
      .from('assessment_types')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id');
    if (!admin) q = q.eq('status', 'published');
    else if (query.status) q = q.eq('status', query.status);
    if (query.category) q = q.eq('category', query.category);
    if (query.search)
      q = q.ilike('title', '%' + query.search.replace(/[%_\\]/g, '') + '%');
    const r = await q.range(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize - 1,
    );
    return { rows: checked(r) as Assessment[], total: r.count ?? 0 };
  }
  async type(id: string, admin = false) {
    let q = this.db.from('assessment_types').select('*').eq('id', id);
    if (!admin) q = q.eq('status', 'published');
    return checked(await q.single()) as Assessment;
  }
  async versions(id: string) {
    const data = checked(
      await this.db
        .from('assessment_versions')
        .select(
          '*,questions:assessment_questions(*,options:assessment_options(*))',
        )
        .eq('assessment_id', id)
        .order('version_number', { ascending: false }),
    ) as Version[];
    return data.map((v) => ({
      ...v,
      questions: v.questions
        .sort((a, b) => a.display_order - b.display_order)
        .map((q) => ({
          ...q,
          options: q.options.sort((a, b) => a.display_order - b.display_order),
        })),
    }));
  }
  async attempts(query: AssessmentQuery, assessmentId?: string) {
    let q = this.scoped
      .from('assessment_attempts')
      .select('*', { count: 'exact' })
      .eq('user_id', this.userId)
      .order('submitted_at', { ascending: false })
      .order('id');
    if (assessmentId || query.assessmentId)
      q = q.eq('assessment_id', assessmentId || query.assessmentId!);
    if (query.from) q = q.gte('submitted_at', query.from + 'T00:00:00Z');
    if (query.to)
      q = q.lt(
        'submitted_at',
        new Date(Date.parse(query.to + 'T00:00:00Z') + 86400000).toISOString(),
      );
    const r = await q.range(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize - 1,
    );
    return { rows: checked(r) as Attempt[], total: r.count ?? 0 };
  }
  async attempt(id: string) {
    return checked(
      await this.scoped
        .from('assessment_attempts')
        .select('*')
        .eq('id', id)
        .eq('user_id', this.userId)
        .single(),
    ) as Attempt;
  }
  async responses(id: string) {
    return checked(
      await this.scoped
        .from('assessment_responses')
        .select('question_id,selected_option_id')
        .eq('attempt_id', id),
    ) as { question_id: string; selected_option_id: string }[];
  }
  async prior(key: string) {
    const r = await this.scoped
      .from('assessment_attempts')
      .select('*')
      .eq('user_id', this.userId)
      .eq('idempotency_key', key)
      .maybeSingle();
    if (r.error) checked(r);
    return r.data as (Attempt & { request_hash: string }) | null;
  }
  async goals() {
    return (
      checked(
        await this.scoped
          .from('user_wellness_goals')
          .select('goal_key')
          .eq('user_id', this.userId),
      ) as { goal_key: GoalKey }[]
    ).map((r) => r.goal_key);
  }
  async rules(assessmentId?: string) {
    let q = this.db
      .from('recommendation_rules')
      .select('*')
      .order('priority')
      .order('id');
    if (assessmentId)
      q = q
        .or('assessment_id.is.null,assessment_id.eq.' + assessmentId)
        .eq('is_active', true);
    return checked(await q) as Rule[];
  }
  async recommendations(query?: AssessmentQuery) {
    let q = this.scoped
      .from('user_recommendations')
      .select('*', { count: 'exact' })
      .eq('user_id', this.userId);
    if (query?.status === 'active') q = q.order('content_snapshot->priority');
    q = q.order('created_at', { ascending: false }).order('id');
    if (query?.status) q = q.eq('status', query.status);
    if (query)
      q = q.range(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize - 1,
      );
    const r = await q;
    const rows = checked(r) as Recommendation[];
    if (rows.length) {
      const links = checked(
        await this.db
          .from('recommendation_rules')
          .select(
            'id,activity_id,activity:wellness_activities(title,is_active)',
          )
          .in('id', [...new Set(rows.map((r) => r.rule_id))]),
      ) as unknown as {
        id: string;
        activity_id: string | null;
        activity: { title: string; is_active: boolean } | null;
      }[];
      return {
        rows: rows.map((r) => {
          const link = links.find((l) => l.id === r.rule_id);
          return {
            ...r,
            activity_id: link?.activity?.is_active ? link.activity_id : null,
            activity_title: link?.activity?.is_active
              ? link.activity.title
              : null,
          };
        }),
        total: r.count ?? 0,
      };
    }
    return { rows, total: r.count ?? 0 };
  }
  async updateRecommendation(id: string, status: string) {
    return checked(
      await this.db
        .from('user_recommendations')
        .update({ status })
        .eq('id', id)
        .eq('user_id', this.userId)
        .select('*')
        .single(),
    ) as Recommendation;
  }
  async createType(input: AssessmentMetadata) {
    return checked(
      await this.db.from('assessment_types').insert(input).select('*').single(),
    ) as Assessment;
  }
  async metadata(id: string, input: Partial<AssessmentMetadata>) {
    return checked(
      await this.db
        .from('assessment_types')
        .update(input)
        .eq('id', id)
        .select('*')
        .single(),
    ) as Assessment;
  }
  async archive(id: string) {
    return checked(
      await this.db
        .from('assessment_types')
        .update({ status: 'archived' })
        .eq('id', id)
        .select('*')
        .single(),
    );
  }
  async draft(id: string) {
    return checked(
      await this.db.rpc('start_assessment_draft', { p_assessment_id: id }),
    ) as string;
  }
  async saveDraft(id: string, v: Version, definition: Definition) {
    const { error } = await this.db.rpc('save_assessment_draft', {
      p_assessment_id: id,
      p_version_id: v.id,
      p_revision: v.draft_revision,
      p_definition: definition,
    });
    if (error) checked({ data: null, error });
  }
  async publish(id: string, v: Version) {
    const { error } = await this.db.rpc('publish_assessment', {
      p_assessment_id: id,
      p_version_id: v.id,
      p_revision: v.draft_revision,
    });
    if (error) checked({ data: null, error });
  }
  async submit(args: Record<string, unknown>) {
    return checked(
      await this.db.rpc('store_assessment_submission', args),
    ) as string;
  }
  async ruleList(query: AssessmentQuery) {
    let q = this.db
      .from('recommendation_rules')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id');
    if (query.activityId) q = q.eq('activity_id', query.activityId);
    if (query.search)
      q = q.ilike('rule_name', '%' + query.search.replace(/[%_\\]/g, '') + '%');
    const r = await q.range(
      (query.page - 1) * query.pageSize,
      query.page * query.pageSize - 1,
    );
    return { rows: checked(r) as Rule[], total: r.count ?? 0 };
  }
  async saveRule(input: Record<string, unknown>, id?: string) {
    return checked(
      await (
        id
          ? this.db.from('recommendation_rules').update(input).eq('id', id)
          : this.db.from('recommendation_rules').insert(input)
      )
        .select('*')
        .single(),
    ) as Rule;
  }
  async linkedActivity(id: string) {
    return checked(
      await this.db
        .from('wellness_activities')
        .select('id')
        .eq('id', id)
        .eq('is_active', true)
        .single(),
    );
  }
  async storeRecommendations(attemptId: string, suggestions: unknown[]) {
    if (!suggestions.length) return;
    checked(
      await this.db
        .from('user_recommendations')
        .upsert(
          suggestions.map((r) => {
            const row = r as { rule_id: string; rule_revision: number };
            return {
              user_id: this.userId,
              assessment_attempt_id: attemptId,
              rule_id: row.rule_id,
              rule_revision: row.rule_revision,
              content_snapshot: r,
            };
          }),
          {
            onConflict: 'user_id,rule_id,rule_revision',
            ignoreDuplicates: true,
          },
        )
        .select('id'),
    );
  }
}
