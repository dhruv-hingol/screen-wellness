import type { Request, RequestHandler } from 'express';
import { analyticsQuerySchema } from '@screenwise/shared';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsRepository } from './analytics.repository.js';
import { AssessmentService } from '../assessments/assessment.service.js';
import { AssessmentRepository } from '../assessments/assessment.repository.js';
import { sendSuccess } from '../../utils/response.js';
export function analyticsService(req: Request) {
  return new AnalyticsService(
    new AnalyticsRepository(req.identity!.id, req.supabase!),
  );
}
export async function dashboardRecommendations(req: Request) {
  const s = new AssessmentService(
    new AssessmentRepository(req.identity!.id, req.supabase!),
  );
  return (
    await s.recommendations({
      page: 1,
      pageSize: 5,
      search: '',
      status: 'active',
    })
  ).rows;
}
export const analyticsHandler =
  (
    fn: (service: AnalyticsService, req: Request) => Promise<unknown>,
  ): RequestHandler =>
  async (req, res, next) => {
    try {
      analyticsQuerySchema.parse(req.query);
      sendSuccess(res, await fn(analyticsService(req), req));
    } catch (error) {
      next(error);
    }
  };
