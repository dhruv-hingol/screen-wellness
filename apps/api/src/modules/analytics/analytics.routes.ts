import { Router } from 'express';
import {
  analyticsQuerySchema,
  wellnessReportDataSchema,
} from '@screenwise/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import {
  analyticsHandler,
  dashboardRecommendations,
} from './analytics.controller.js';
export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate);
dashboardRoutes.get(
  '/summary',
  analyticsHandler((s) => s.summary()),
);
dashboardRoutes.get(
  '/recommendations',
  analyticsHandler((_s, r) => dashboardRecommendations(r)),
);
dashboardRoutes.get(
  '/weekly-activity',
  analyticsHandler(
    async (s) =>
      (await s.personal(analyticsQuerySchema.parse({ range: '7d' }))).daily,
  ),
);
dashboardRoutes.get(
  '/recent-activity',
  analyticsHandler(
    async (s, r) =>
      (await s.personal(analyticsQuerySchema.parse(r.query))).timeline,
  ),
);
dashboardRoutes.get(
  '/goals',
  analyticsHandler(
    async (s) =>
      (await s.personal(analyticsQuerySchema.parse({ range: '7d' }))).goals,
  ),
);
export const analyticsRoutes = Router();
analyticsRoutes.use(authenticate);
for (const [path, key] of [
  ['overview', 'overview'],
  ['assessments', 'assessments'],
  ['activities', 'daily'],
  ['activity-distribution', 'distribution'],
  ['goals', 'goals'],
  ['streaks', 'streak'],
  ['timeline', 'timeline'],
] as const) {
  analyticsRoutes.get(
    '/' + path,
    analyticsHandler(async (s, r) => {
      const result = await s.personal(analyticsQuerySchema.parse(r.query));
      return {
        period: result.period,
        data: result[key],
        ...(key === 'assessments' ? { history: result.assessmentHistory } : {}),
      };
    }),
  );
}
analyticsRoutes.get(
  '/report-data',
  analyticsHandler(async (s, r) =>
    wellnessReportDataSchema.parse({
      ...(await s.personal(analyticsQuerySchema.parse(r.query))),
      recommendations: await dashboardRecommendations(r),
    }),
  ),
);
// One combined DTO avoids eight parallel, overlapping database aggregations per page.
analyticsRoutes.get(
  '/dashboard',
  analyticsHandler((s, r) => s.personal(analyticsQuerySchema.parse(r.query))),
);
export const adminAnalyticsRoutes = Router();
adminAnalyticsRoutes.use(authenticate, authorize('ADMIN'));
adminAnalyticsRoutes.get(
  '/dashboard',
  analyticsHandler((s, r) => s.admin(analyticsQuerySchema.parse(r.query))),
);
for (const key of [
  'overview',
  'users',
  'assessments',
  'activities',
  'content',
  'engagement',
] as const)
  adminAnalyticsRoutes.get(
    '/' + key,
    analyticsHandler(async (s, r) => {
      const result = await s.admin(analyticsQuerySchema.parse(r.query));
      return { period: result.period, data: result[key] };
    }),
  );
