import { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import {
  assessmentQuerySchema,
  metadataSchema,
  draftSaveSchema,
  submissionSchema,
  ruleInputSchema,
  recommendationStatusSchema,
  questionInputSchema,
} from '@screenwise/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { sendSuccess } from '../../utils/response.js';
import { AssessmentRepository } from './assessment.repository.js';
import { AssessmentService } from './assessment.service.js';
const uuid = z.uuid();
function service(req: Request) {
  return new AssessmentService(
    new AssessmentRepository(req.identity!.id, req.supabase!),
  );
}
const run =
  (
    fn: (s: AssessmentService, r: Request) => Promise<unknown>,
    status = 200,
  ): RequestHandler =>
  async (req, res, next) => {
    try {
      sendSuccess(res, await fn(service(req), req), status);
    } catch (e) {
      next(e);
    }
  };
const list =
  (
    fn: (
      s: AssessmentService,
      r: Request,
    ) => Promise<{ rows: unknown[]; total: number }>,
  ): RequestHandler =>
  async (req, res, next) => {
    try {
      const q = assessmentQuerySchema.parse(req.query);
      const result = await fn(service(req), req);
      res.json({
        success: true,
        data: result.rows,
        meta: {
          page: q.page,
          pageSize: q.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / q.pageSize),
        },
      });
    } catch (e) {
      next(e);
    }
  };
export const assessmentRoutes = Router();
assessmentRoutes.use(authenticate);
assessmentRoutes.get(
  '/',
  list((s, r) => s.list(assessmentQuerySchema.parse(r.query))),
);
assessmentRoutes.get(
  '/history',
  list((s, r) => s.history(assessmentQuerySchema.parse(r.query))),
);
assessmentRoutes.get(
  '/attempts/:attemptId',
  run((s, r) => s.result(uuid.parse(r.params.attemptId))),
);
assessmentRoutes.get(
  '/:id/trends',
  run((s, r) => s.trends(uuid.parse(r.params.id))),
);
assessmentRoutes.get(
  '/:id',
  run((s, r) => s.detail(uuid.parse(r.params.id))),
);
assessmentRoutes.post(
  '/:id/submit',
  run(
    (s, r) => s.submit(uuid.parse(r.params.id), submissionSchema.parse(r.body)),
    201,
  ),
);
export const recommendationRoutes = Router();
recommendationRoutes.use(authenticate);
recommendationRoutes.get(
  '/me',
  list((s, r) => s.recommendations(assessmentQuerySchema.parse(r.query))),
);
recommendationRoutes.post(
  '/refresh',
  run((s) => s.refresh()),
);
recommendationRoutes.patch(
  '/:id',
  run((s, r) =>
    s.updateRecommendation(
      uuid.parse(r.params.id),
      recommendationStatusSchema.parse(r.body).status,
    ),
  ),
);
export const adminAssessmentRoutes = Router();
adminAssessmentRoutes.use(authenticate, authorize('ADMIN'));
adminAssessmentRoutes.get(
  '/',
  list((s, r) => s.list(assessmentQuerySchema.parse(r.query), true)),
);
adminAssessmentRoutes.post(
  '/',
  run((s, r) => s.create(metadataSchema.parse(r.body)), 201),
);
adminAssessmentRoutes.get(
  '/:id',
  run((s, r) => s.detail(uuid.parse(r.params.id), true)),
);
adminAssessmentRoutes.patch(
  '/:id',
  run((s, r) =>
    s.metadata(uuid.parse(r.params.id), metadataSchema.partial().parse(r.body)),
  ),
);
adminAssessmentRoutes.post(
  '/:id/drafts',
  run((s, r) => s.draft(uuid.parse(r.params.id)), 201),
);
adminAssessmentRoutes.put(
  '/:id/draft',
  run((s, r) => {
    const { revision, ...definition } = draftSaveSchema.parse(r.body);
    return s.save(uuid.parse(r.params.id), revision, definition);
  }),
);
adminAssessmentRoutes.post(
  '/:id/publish',
  run((s, r) =>
    s.publish(
      uuid.parse(r.params.id),
      z.strictObject({ revision: z.number().int().min(0) }).parse(r.body)
        .revision,
    ),
  ),
);
adminAssessmentRoutes.post(
  '/:id/archive',
  run((s, r) => s.archive(uuid.parse(r.params.id))),
);
adminAssessmentRoutes.post(
  '/:id/questions',
  run(
    (s, r) =>
      s.editQuestion(uuid.parse(r.params.id), undefined, {
        ...questionInputSchema.parse(r.body),
        display_order: 0,
      }),
    201,
  ),
);
adminAssessmentRoutes.patch(
  '/:id/questions/:questionId',
  run((s, r) =>
    s.editQuestion(uuid.parse(r.params.id), uuid.parse(r.params.questionId), {
      ...questionInputSchema.parse(r.body),
      display_order: 0,
    }),
  ),
);
export const adminRecommendationRoutes = Router();
adminRecommendationRoutes.use(authenticate, authorize('ADMIN'));
adminRecommendationRoutes.get(
  '/',
  list((s, r) => s.rules(assessmentQuerySchema.parse(r.query))),
);
adminRecommendationRoutes.post(
  '/',
  run((s, r) => s.saveRule(ruleInputSchema.parse(r.body)), 201),
);
adminRecommendationRoutes.patch(
  '/:id',
  run((s, r) =>
    s.saveRule(ruleInputSchema.parse(r.body), uuid.parse(r.params.id)),
  ),
);
adminRecommendationRoutes.delete(
  '/:id',
  run((s, r) => s.deactivateRule(uuid.parse(r.params.id))),
);
