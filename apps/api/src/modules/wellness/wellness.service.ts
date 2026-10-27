import type {
  WellnessQuery,
  GoalInput,
  ActivityInput,
  ReminderInput,
} from '@screenwise/shared';
import { WellnessRepository } from './wellness.repository.js';
import { goalProgress, dueReminder, localDate } from './progress.service.js';
import { AppError } from '../../utils/app-error.js';
export class WellnessService {
  constructor(private repo: WellnessRepository) {}
  activities(q: WellnessQuery, admin = false) {
    return this.repo.activities(q, admin);
  }
  activity(id: string) {
    return this.repo.activity(id);
  }
  start(id: string, key: string, source: string) {
    return this.repo.start(id, key, source);
  }
  finish(id: string, status: string) {
    return this.repo.finish(id, status);
  }
  history(q: WellnessQuery) {
    return this.repo.history(q);
  }
  async goals(q: WellnessQuery) {
    const [result, sessions] = await Promise.all([
      this.repo.goals(q),
      this.repo.completed(),
    ]);
    return {
      ...result,
      rows: result.rows.map((g) => ({
        ...g,
        progress: goalProgress(g, sessions),
      })),
    };
  }
  async goal(id: string) {
    const [goal, sessions] = await Promise.all([
      this.repo.goal(id),
      this.repo.completed(),
    ]);
    return { ...goal, progress: goalProgress(goal, sessions) };
  }
  async saveGoal(
    input: GoalInput | null,
    id: string | null,
    status: string | null,
  ) {
    await this.repo.saveGoal(input, id, status);
    return id ? this.goal(id) : this.summary();
  }
  async createGoal(input: GoalInput) {
    const g = await this.repo.saveGoal(input, null, null);
    return this.goal(g.id);
  }
  async summary() {
    const [goals, interests, sessions] = await Promise.all([
      this.repo.goals(),
      this.repo.interests(),
      this.repo.completed(),
    ]);
    return {
      goals: goals.rows.map((g) => ({
        ...g,
        progress: goalProgress(g, sessions),
      })),
      interests: interests.map((v) => v.goal_key),
    };
  }
  async today(q: WellnessQuery) {
    const prefs = await this.repo.preferences();
    const timezone = q.timezone ?? prefs.timezone;
    const today = localDate(new Date(), timezone);
    const date = q.date ?? today;
    if (date > today)
      throw new AppError(
        400,
        'INVALID_DATE',
        'Choose today or an earlier date.',
      );
    const [sessions, goals] = await Promise.all([
      this.repo.completed(),
      this.repo.goals(),
    ]);
    let activities = await this.repo.checklist(date, timezone);
    let recordedPlan = !!activities;
    if (!activities && date === today) {
      const [available, interests] = await Promise.all([
        this.repo.activities({ page: 1, pageSize: 100, search: '' }),
        this.repo.interests(),
      ]);
      const categories = new Set(
        interests.map(
          (v) =>
            ({
              eye_comfort: 'EYE_COMFORT',
              posture: 'POSTURE',
              sleep: 'SLEEP',
              screen_breaks: 'DIGITAL_BREAK',
              digital_fatigue: 'DIGITAL_BREAK',
              overall_wellness: 'MOVEMENT',
            })[v.goal_key],
        ),
      );
      const linked = new Set(
        goals.rows
          .filter(
            (g) =>
              g.status === 'ACTIVE' &&
              g.start_date <= date &&
              (!g.end_date || g.end_date >= date),
          )
          .flatMap((g) => g.activity_ids),
      );
      const chosen = available.rows.filter(
        (a) => linked.has(a.id) || categories.has(a.category),
      );
      const pool = chosen.length ? chosen : available.rows;
      const starters = [...new Map(pool.map((a) => [a.category, a])).values()];
      const ids = new Set([...linked, ...starters.map((a) => a.id)]);
      activities = await this.repo.ensureChecklist(
        date,
        timezone,
        pool.filter((a) => ids.has(a.id)).slice(0, 20),
      );
      recordedPlan = true;
    }
    const daySessions = sessions.filter(
      (s) => s.completed_at && localDate(s.completed_at, timezone) === date,
    );
    activities ??= [
      ...new Map(
        daySessions.map((s) => [s.activity_id, s.activity_snapshot]),
      ).values(),
    ];
    return {
      date,
      timezone,
      recordedPlan,
      activities,
      sessions: daySessions,
      completedActivityIds: [...new Set(daySessions.map((s) => s.activity_id))],
      goals: goals.rows
        .filter((g) => g.status === 'ACTIVE')
        .map((g) => ({ ...g, progress: goalProgress(g, sessions) })),
    };
  }
  reminders() {
    return this.repo.reminders();
  }
  saveReminder(body: ReminderInput, id?: string) {
    return this.repo.saveReminder(body, id);
  }
  deleteReminder(id: string) {
    return this.repo.deleteReminder(id);
  }
  async poll() {
    const prefs = await this.repo.preferences();
    if (!prefs.notifications_enabled) return [];
    const candidates = (await this.repo.reminders())
      .map((r) => dueReminder(r))
      .filter((r) => r !== null);
    return candidates.length ? this.repo.insertNotifications(candidates) : [];
  }
  notifications(q: WellnessQuery) {
    return this.repo.notifications(q);
  }
  unread() {
    return this.repo.unread();
  }
  read(id: string) {
    return this.repo.read(id);
  }
  readAll() {
    return this.repo.readAll();
  }
  saveActivity(body: ActivityInput, id?: string) {
    return this.repo.saveActivity(body, id);
  }
  archiveActivity(id: string) {
    return this.repo.archiveActivity(id);
  }
}
