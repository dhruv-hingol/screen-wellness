import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  activityInputSchema,
  sessionStartSchema,
  sessionPatchSchema,
  goalInputSchema,
  goalStatusSchema,
  reminderInputSchema,
  wellnessQuerySchema,
} from '@screenwise/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { sendSuccess } from '../../utils/response.js';
import { WellnessRepository } from './wellness.repository.js';
import { WellnessService } from './wellness.service.js';
const uuid = z.uuid();
const service = (req: Request) =>
  new WellnessService(new WellnessRepository(req.identity!.id, req.supabase!));
const run =
  (
    fn: (s: WellnessService, r: Request) => Promise<unknown>,
    status = 200,
  ): RequestHandler =>
  async (req, res, next) => {
    try {
      sendSuccess(res, await fn(service(req), req), status);
    } catch (error) {
      next(error);
    }
  };
const list =
  (
    fn: (
      s: WellnessService,
      r: Request,
    ) => Promise<{ rows: unknown[]; total: number }>,
  ): RequestHandler =>
  async (req, res, next) => {
    try {
      const q = wellnessQuerySchema.parse(req.query);
      const r = await fn(service(req), req);
      res.json({
        success: true,
        data: r.rows,
        meta: {
          page: q.page,
          pageSize: q.pageSize,
          total: r.total,
          totalPages: Math.ceil(r.total / q.pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  };
export const activityRoutes = Router();
activityRoutes.use(authenticate);
activityRoutes.get(
  '/',
  list((s, r) => s.activities(wellnessQuerySchema.parse(r.query))),
);
activityRoutes.get(
  '/history',
  list((s, r) => s.history(wellnessQuerySchema.parse(r.query))),
);
activityRoutes.get(
  '/today',
  run((s, r) => s.today(wellnessQuerySchema.parse(r.query))),
);
activityRoutes.patch(
  '/sessions/:sessionId',
  run((s, r) =>
    s.finish(
      uuid.parse(r.params.sessionId),
      sessionPatchSchema.parse(r.body).status,
    ),
  ),
);
activityRoutes.get(
  '/:id',
  run((s, r) => s.activity(uuid.parse(r.params.id))),
);
activityRoutes.post(
  '/:id/sessions',
  run((s, r) => {
    const body = sessionStartSchema.parse(r.body);
    return s.start(uuid.parse(r.params.id), body.idempotencyKey, body.source);
  }, 201),
);
export const goalRoutes = Router();
goalRoutes.use(authenticate);
goalRoutes.get(
  '/',
  list((s, r) => s.goals(wellnessQuerySchema.parse(r.query))),
);
goalRoutes.get(
  '/summary',
  run((s) => s.summary()),
);
goalRoutes.post(
  '/',
  run((s, r) => s.createGoal(goalInputSchema.parse(r.body)), 201),
);
goalRoutes.get(
  '/:id/progress',
  run(async (s, r) => (await s.goal(uuid.parse(r.params.id))).progress),
);
goalRoutes.get(
  '/:id',
  run((s, r) => s.goal(uuid.parse(r.params.id))),
);
goalRoutes.patch(
  '/:id',
  run((s, r) => {
    const input = z.union([goalInputSchema, goalStatusSchema]).parse(r.body);
    return s.saveGoal(
      'status' in input ? null : input,
      uuid.parse(r.params.id),
      'status' in input ? input.status : null,
    );
  }),
);
goalRoutes.delete(
  '/:id',
  run((s, r) => s.saveGoal(null, uuid.parse(r.params.id), 'ARCHIVED')),
);
export const reminderRoutes = Router();
reminderRoutes.use(authenticate);
reminderRoutes.get(
  '/',
  run((s) => s.reminders()),
);
reminderRoutes.post(
  '/poll',
  run((s) => s.poll()),
);
reminderRoutes.post(
  '/',
  run((s, r) => s.saveReminder(reminderInputSchema.parse(r.body)), 201),
);
reminderRoutes.patch(
  '/:id',
  run((s, r) =>
    s.saveReminder(reminderInputSchema.parse(r.body), uuid.parse(r.params.id)),
  ),
);
reminderRoutes.delete(
  '/:id',
  run((s, r) => s.deleteReminder(uuid.parse(r.params.id))),
);
export const notificationRoutes = Router();
notificationRoutes.use(authenticate);
notificationRoutes.get(
  '/',
  list((s, r) => s.notifications(wellnessQuerySchema.parse(r.query))),
);
notificationRoutes.get(
  '/unread-count',
  run((s) => s.unread()),
);
notificationRoutes.post(
  '/read-all',
  run((s) => s.readAll()),
);
notificationRoutes.patch(
  '/:id/read',
  run((s, r) => {
    z.strictObject({}).parse(r.body ?? {});
    return s.read(uuid.parse(r.params.id));
  }),
);
export const adminActivityRoutes = Router();
adminActivityRoutes.use(authenticate, authorize('ADMIN'));
adminActivityRoutes.get(
  '/',
  list((s, r) => s.activities(wellnessQuerySchema.parse(r.query), true)),
);
adminActivityRoutes.post(
  '/',
  run((s, r) => s.saveActivity(activityInputSchema.parse(r.body)), 201),
);
adminActivityRoutes.patch(
  '/:id',
  run((s, r) =>
    s.saveActivity(activityInputSchema.parse(r.body), uuid.parse(r.params.id)),
  ),
);
adminActivityRoutes.delete(
  '/:id',
  run((s, r) => s.archiveActivity(uuid.parse(r.params.id))),
);
