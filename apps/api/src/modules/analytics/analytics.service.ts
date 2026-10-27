import type {
  AnalyticsQuery,
  PersonalAnalytics,
  ReportingPeriod,
  StreakSummary,
  GoalInsight,
} from '@screenwise/shared';
import {
  analyticsQuerySchema,
  personalAnalyticsSchema,
  dashboardSummarySchema,
  adminAnalyticsSchema,
} from '@screenwise/shared';
import {
  goalProgressFromCounts,
  localDate,
  addDays,
} from '../wellness/progress.service.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { AppError } from '../../utils/app-error.js';

export function reportingPeriod(
  query: AnalyticsQuery,
  timezone: string,
  now = new Date(),
): ReportingPeriod {
  const q = analyticsQuerySchema.parse(query);
  const today = localDate(now, timezone);
  const endDate = q.endDate ?? today;
  if (endDate > today)
    throw new AppError(
      400,
      'INVALID_RANGE',
      'Reporting ranges cannot include future days.',
    );
  return {
    startDate:
      q.startDate ??
      addDays(today, 1 - Number((q.range ?? '30d').slice(0, -1))),
    endDate,
    timezone,
  };
}
export class AnalyticsService {
  constructor(private repo: AnalyticsRepository) {}
  async period(query: AnalyticsQuery) {
    return reportingPeriod(query, await this.repo.timezone());
  }
  async personal(query: AnalyticsQuery): Promise<PersonalAnalytics> {
    const period = await this.period(query);
    const raw = await this.repo.personal(period, query);
    const { goalDefinitions, goalCounts, goalAsOf, ...data } = raw;
    const now = new Date(data.generatedAt);
    // A historical report evaluates goals as of its last local date. PostgreSQL
    // provides the exact DST-aware upper bound below via date resolution.
    const rows: GoalInsight[] = goalDefinitions.map((g) => {
      const counts = goalCounts[g.id] ?? {};
      const asOf = new Date(goalAsOf[g.id] ?? data.generatedAt);
      const current = goalProgressFromCounts(g, counts, asOf);
      const scopedCounts = Object.fromEntries(
        Object.entries(counts).filter(
          ([d]) => d >= period.startDate && d <= period.endDate,
        ),
      );
      const filtered = goalProgressFromCounts(g, scopedCounts, asOf);
      return {
        id: g.id,
        title: g.title,
        status: g.status,
        period: g.period,
        timezone: g.timezone,
        ...current,
        history: filtered.history.filter(
          (h) => h.date >= period.startDate && h.date <= period.endDate,
        ),
      };
    });
    const applicable = goalDefinitions.filter((g) => {
      const asOf = new Date(goalAsOf[g.id] ?? now);
      const day = localDate(asOf, g.timezone);
      return (
        g.status === 'ACTIVE' &&
        g.start_date <= day &&
        (!g.end_date || g.end_date >= day)
      );
    });
    const active = new Set(applicable.map((g) => g.id));
    const streakGoal = rows
      .filter((g) => active.has(g.id))
      .sort(
        (a, b) => b.currentStreak - a.currentStreak || a.id.localeCompare(b.id),
      )[0];
    const streak: StreakSummary = {
      current: streakGoal?.currentStreak ?? 0,
      longest: streakGoal?.longestStreak ?? 0,
      unit: streakGoal?.streakUnit ?? 'days',
      goalId: streakGoal?.id ?? null,
      goalTitle: streakGoal?.title ?? null,
    };
    const periods = rows.flatMap((g) => g.history).filter((h) => !h.paused);
    const achieved = periods.filter((h) => h.met).length;
    const completionPercentage = periods.length
      ? Math.round((achieved / periods.length) * 100)
      : 0;
    return personalAnalyticsSchema.parse({
      ...data,
      goals: {
        rows,
        active: active.size,
        achieved,
        pending: periods.length - achieved,
        completionPercentage,
      },
      streak,
      overview: {
        ...data.overview,
        activeGoals: active.size,
        goalCompletionPercentage: completionPercentage,
      },
    });
  }
  async summary() {
    const personal = await this.personal(
      analyticsQuerySchema.parse({ range: '7d' }),
    );
    const summary = await this.repo.dashboard(personal.period.timezone);
    return dashboardSummarySchema.parse({
      ...summary,
      period: personal.period,
      activeGoals: personal.goals.active,
      achievedGoals: personal.goals.achieved,
      streak: personal.streak,
    });
  }
  async admin(query: AnalyticsQuery) {
    return adminAnalyticsSchema.parse(
      await this.repo.admin(await this.period(query)),
    );
  }
}
