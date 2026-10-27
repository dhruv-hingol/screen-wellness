import {
  activityRoutes,
  goalRoutes,
  reminderRoutes,
  notificationRoutes,
  adminActivityRoutes,
} from './modules/wellness/wellness.routes.js';
import {
  assessmentRoutes,
  recommendationRoutes,
  adminAssessmentRoutes,
  adminRecommendationRoutes,
} from './modules/assessments/assessment.routes.js';
import express from 'express';
import {
  dashboardRoutes,
  analyticsRoutes,
  adminAnalyticsRoutes,
} from './modules/analytics/analytics.routes.js';
import {
  articleRoutes,
  bookmarkRoutes,
  adminArticleRoutes,
  adminCategoryRoutes,
  adminTagRoutes,
  adminMediaRoutes,
  adminContentRoutes,
} from './modules/library/library.routes.js';
import { rateLimit } from 'express-rate-limit';
import { userRoutes } from './modules/users/user.routes.js';
import { authenticate } from './middleware/authenticate.js';
import { authorize } from './middleware/authorize.js';
import { sendSuccess } from './utils/response.js';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { API_PREFIX } from '@screenwise/shared';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { health } from './modules/health/health.controller.js';
import { errorHandler, notFound } from './middleware/errors.js';
export const app = express();
app.disable('x-powered-by');
app.use(
  pinoHttp({ logger }),
  helmet(),
  cors({ origin: env.FRONTEND_URL }),
  express.json({ limit: '100kb' }),
);
const router = express.Router();
router.use(
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Try again shortly.',
      },
    },
  }),
);
router.get('/health', health);
router.use('/dashboard', dashboardRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/admin/analytics', adminAnalyticsRoutes);
router.use('/articles', articleRoutes);
router.use('/bookmarks', bookmarkRoutes);
router.use('/admin/articles', adminArticleRoutes);
router.use('/admin/categories', adminCategoryRoutes);
router.use('/admin/tags', adminTagRoutes);
router.use('/admin/media', adminMediaRoutes);
router.use('/admin/content', adminContentRoutes);
router.use('/users', userRoutes);
router.use('/activities', activityRoutes);
router.use('/goals', goalRoutes);
router.use('/reminders', reminderRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin/activities', adminActivityRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/admin/assessments', adminAssessmentRoutes);
router.use('/admin/recommendations', adminRecommendationRoutes);
router.get('/admin/access', authenticate, authorize('ADMIN'), (_req, res) => {
  sendSuccess(res, { authorized: true });
});
app.use(API_PREFIX, router);
app.use(notFound, errorHandler);
