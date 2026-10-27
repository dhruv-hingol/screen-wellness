import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Activity,
  ActivityInput,
  ActivitySession,
  WellnessGoal,
  GoalInput,
  Reminder,
  ReminderInput,
  WellnessNotification,
  WellnessQuery,
} from '@screenwise/shared';
import { getAdminClient } from '../../config/supabase.js';
import { AppError } from '../../utils/app-error.js';
export function wellnessChecked<T>(r: {
  data: T;
  error: { code?: string } | null;
}): NonNullable<T> {
  if (r.error) {
    if (r.error.code === '40001' || r.error.code === '23505')
      throw new AppError(
        409,
        'CONFLICT',
        'This record changed or already exists. Reload and try again.',
      );
    if (r.error.code === 'PGRST116' || r.error.code === 'P0002')
      throw new AppError(404, 'NOT_FOUND', 'Wellness record not found.');
    if (r.error.code === 'P0001' || r.error.code === '23514')
      throw new AppError(
        400,
        'INVALID_WELLNESS_DATA',
        'Check the selected activities and wellness settings.',
      );
    throw new AppError(
      503,
      'WELLNESS_UNAVAILABLE',
      'Wellness data is unavailable. Confirm the Phase 4 migration is installed.',
    );
  }
  if (r.data === null)
    throw new AppError(404, 'NOT_FOUND', 'Wellness record not found.');
  return r.data!;
}
export class WellnessRepository {
  private db = getAdminClient();
  constructor(
    public userId: string,
    private scoped: SupabaseClient,
  ) {}
  async preferences() {
    return wellnessChecked(
      await this.scoped
        .from('user_preferences')
        .select('timezone,notifications_enabled')
        .eq('user_id', this.userId)
        .single(),
    ) as { timezone: string; notifications_enabled: boolean };
  }
  async activities(q: WellnessQuery, admin = false) {
    let request = (admin ? this.db : this.scoped)
      .from('wellness_activities')
      .select('*', { count: 'exact' })
      .order('created_at')
      .order('id');
    if (!admin) request = request.eq('is_active', true);
    if (q.category) request = request.eq('category', q.category);
    if (q.difficulty) request = request.eq('difficulty', q.difficulty);
    if (q.maxDuration) request = request.lte('duration_seconds', q.maxDuration);
    if (q.search)
      request = request.ilike(
        'title',
        '%' + q.search.replace(/[%_\\]/g, '') + '%',
      );
    const r = await request.range(
      (q.page - 1) * q.pageSize,
      q.page * q.pageSize - 1,
    );
    return { rows: wellnessChecked(r) as Activity[], total: r.count ?? 0 };
  }
  async activity(id: string, admin = false) {
    let q = (admin ? this.db : this.scoped)
      .from('wellness_activities')
      .select('*')
      .eq('id', id);
    if (!admin) q = q.eq('is_active', true);
    return wellnessChecked(await q.single()) as Activity;
  }
  async saveActivity(body: ActivityInput, id?: string) {
    return wellnessChecked(
      await (
        id
          ? this.db.from('wellness_activities').update(body).eq('id', id)
          : this.db.from('wellness_activities').insert(body)
      )
        .select('*')
        .single(),
    ) as Activity;
  }
  async archiveActivity(id: string) {
    return wellnessChecked(
      await this.db
        .from('wellness_activities')
        .update({ is_active: false })
        .eq('id', id)
        .select('*')
        .single(),
    );
  }
  async start(id: string, key: string, source: string) {
    const sessionId = wellnessChecked(
      await this.db.rpc('start_activity_session', {
        p_user_id: this.userId,
        p_activity_id: id,
        p_key: key,
        p_source: source,
      }),
    );
    return this.session(String(sessionId));
  }
  async finish(id: string, status: string) {
    wellnessChecked(
      await this.db.rpc('finish_activity_session', {
        p_user_id: this.userId,
        p_session_id: id,
        p_status: status,
      }),
    );
    return this.session(id);
  }
  async session(id: string) {
    return wellnessChecked(
      await this.scoped
        .from('activity_sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', this.userId)
        .single(),
    ) as ActivitySession;
  }
  async history(q: WellnessQuery) {
    let request = this.scoped
      .from('activity_sessions')
      .select('*', { count: 'exact' })
      .eq('user_id', this.userId)
      .order('started_at', { ascending: false })
      .order('id');
    if (q.status) request = request.eq('status', q.status);
    const r = await request.range(
      (q.page - 1) * q.pageSize,
      q.page * q.pageSize - 1,
    );
    return {
      rows: wellnessChecked(r) as ActivitySession[],
      total: r.count ?? 0,
    };
  }
  async completed() {
    const all: ActivitySession[] = [];
    for (let page = 0; ; page++) {
      const rows = wellnessChecked(
        await this.scoped
          .from('activity_sessions')
          .select('*')
          .eq('user_id', this.userId)
          .eq('status', 'COMPLETED')
          .order('id')
          .range(page * 1000, page * 1000 + 999),
      ) as ActivitySession[];
      all.push(...rows);
      if (rows.length < 1000) break;
    }
    return all;
  }
  async goals(q?: WellnessQuery) {
    let query = this.scoped
      .from('wellness_goals')
      .select('*,links:goal_activity_links(activity_id)', { count: 'exact' })
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .order('id');
    if (q?.status) query = query.eq('status', q.status);
    if (q)
      query = query.range((q.page - 1) * q.pageSize, q.page * q.pageSize - 1);
    const r = await query;
    const rows = wellnessChecked(r) as (WellnessGoal & {
      links: { activity_id: string }[];
    })[];
    return {
      rows: rows.map(({ links, ...g }) => ({
        ...g,
        activity_ids: links.map((l) => l.activity_id),
      })),
      total: r.count ?? 0,
    };
  }
  async goal(id: string) {
    const g = wellnessChecked(
      await this.scoped
        .from('wellness_goals')
        .select('*,links:goal_activity_links(activity_id)')
        .eq('id', id)
        .eq('user_id', this.userId)
        .single(),
    ) as WellnessGoal & { links: { activity_id: string }[] };
    const { links, ...row } = g;
    return { ...row, activity_ids: links.map((l) => l.activity_id) };
  }
  async saveGoal(
    body: GoalInput | null,
    id: string | null,
    status: string | null,
  ) {
    const result = wellnessChecked(
      await this.db.rpc('save_wellness_goal', {
        p_user_id: this.userId,
        p_goal_id: id,
        p_definition: body,
        p_status: status,
      }),
    );
    return this.goal(String(result));
  }
  async interests() {
    return wellnessChecked(
      await this.scoped
        .from('user_wellness_goals')
        .select('goal_key')
        .eq('user_id', this.userId),
    ) as { goal_key: string }[];
  }
  async reminders() {
    return wellnessChecked(
      await this.scoped
        .from('reminder_settings')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at'),
    ) as Reminder[];
  }
  async saveReminder(body: ReminderInput, id?: string) {
    return wellnessChecked(
      await (
        id
          ? this.db
              .from('reminder_settings')
              .update(body)
              .eq('id', id)
              .eq('user_id', this.userId)
          : this.db
              .from('reminder_settings')
              .insert({ ...body, user_id: this.userId })
      )
        .select('*')
        .single(),
    ) as Reminder;
  }
  async deleteReminder(id: string) {
    wellnessChecked(
      await this.db
        .from('reminder_settings')
        .delete()
        .eq('id', id)
        .eq('user_id', this.userId)
        .select('id')
        .single(),
    );
    return { id, deleted: true };
  }
  async insertNotifications(candidates: unknown[]) {
    return wellnessChecked(
      await this.db.rpc('insert_active_reminders', {
        p_user_id: this.userId,
        p_candidates: candidates,
      }),
    ) as WellnessNotification[];
  }
  async notifications(q: WellnessQuery) {
    let request = this.scoped
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .order('id');
    if (q.unread === 'true') request = request.eq('is_read', false);
    const r = await request.range(
      (q.page - 1) * q.pageSize,
      q.page * q.pageSize - 1,
    );
    return {
      rows: wellnessChecked(r) as WellnessNotification[],
      total: r.count ?? 0,
    };
  }
  async unread() {
    const r = await this.scoped
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', this.userId)
      .eq('is_read', false)
      .range(0, 0);
    wellnessChecked(r);
    return { count: r.count ?? 0 };
  }
  async read(id: string) {
    return wellnessChecked(
      await this.db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', this.userId)
        .eq('id', id)
        .select('*')
        .single(),
    ) as WellnessNotification;
  }
  async readAll() {
    const r = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', this.userId)
      .eq('is_read', false)
      .select('id');
    return { updated: wellnessChecked(r).length };
  }
  async checklist(date: string, timezone: string) {
    const r = await this.scoped
      .from('daily_wellness_checklists')
      .select('activity_snapshot')
      .eq('user_id', this.userId)
      .eq('date', date)
      .eq('timezone', timezone)
      .maybeSingle();
    if (r.error) wellnessChecked(r);
    return r.data?.activity_snapshot as Activity[] | undefined;
  }
  async ensureChecklist(
    date: string,
    timezone: string,
    activities: Activity[],
  ) {
    return wellnessChecked(
      await this.db.rpc('ensure_daily_checklist', {
        p_user_id: this.userId,
        p_date: date,
        p_timezone: timezone,
        p_activities: activities,
      }),
    ) as Activity[];
  }
}
