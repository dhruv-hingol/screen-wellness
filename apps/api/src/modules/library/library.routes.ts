import { Router, type Request, type RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  articleInputSchema,
  articleQuerySchema,
  categoryInputSchema,
  tagInputSchema,
  contentSlugSchema,
  articleTransitionSchema,
  bookmarkInputSchema,
} from '@screenwise/shared';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/app-error.js';
import { LibraryRepository } from './library.repository.js';
import { LibraryService } from './library.service.js';
const uuid = z.uuid();
const service = (r: Request) =>
  new LibraryService(new LibraryRepository(r.identity!.id, r.supabase!));
const run =
  (
    fn: (s: LibraryService, r: Request) => Promise<unknown>,
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
      s: LibraryService,
      r: Request,
    ) => Promise<{ rows: unknown[]; total: number }>,
  ): RequestHandler =>
  async (req, res, next) => {
    try {
      const q = articleQuerySchema.parse(req.query),
        result = await fn(service(req), req);
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
    } catch (error) {
      next(error);
    }
  };
export const articleRoutes = Router();
articleRoutes.use(authenticate);
articleRoutes.get(
  '/',
  list((s, r) => s.articles(articleQuerySchema.parse(r.query))),
);
articleRoutes.get(
  '/categories',
  run((s) => s.categories()),
);
articleRoutes.get(
  '/tags',
  run((s) => s.tags()),
);
articleRoutes.get(
  '/:slug/related',
  run((s, r) => s.related(contentSlugSchema.parse(r.params.slug))),
);
articleRoutes.get(
  '/:slug',
  run((s, r) => s.article(contentSlugSchema.parse(r.params.slug))),
);
export const bookmarkRoutes = Router();
bookmarkRoutes.use(authenticate);
bookmarkRoutes.get(
  '/',
  list((s, r) => s.bookmarks(articleQuerySchema.parse(r.query))),
);
bookmarkRoutes.post(
  '/',
  run((s, r) => s.bookmark(bookmarkInputSchema.parse(r.body).articleId), 201),
);
bookmarkRoutes.delete(
  '/:articleId',
  run((s, r) => s.removeBookmark(uuid.parse(r.params.articleId))),
);
export const adminArticleRoutes = Router();
adminArticleRoutes.use(authenticate, authorize('ADMIN'));
adminArticleRoutes.get(
  '/',
  list((s, r) => s.articles(articleQuerySchema.parse(r.query), true)),
);
adminArticleRoutes.post(
  '/',
  run((s, r) => s.save(articleInputSchema.parse(r.body)), 201),
);
adminArticleRoutes.get(
  '/:id',
  run((s, r) => s.article(uuid.parse(r.params.id), true)),
);
adminArticleRoutes.patch(
  '/:id',
  run((s, r) =>
    s.save(articleInputSchema.parse(r.body), uuid.parse(r.params.id)),
  ),
);
for (const [action, status] of [
  ['publish', 'PUBLISHED'],
  ['unpublish', 'DRAFT'],
  ['archive', 'ARCHIVED'],
] as const)
  adminArticleRoutes.post(
    '/:id/' + action,
    run((s, r) =>
      s.transition(
        uuid.parse(r.params.id),
        articleTransitionSchema.parse(r.body).revision,
        status,
      ),
    ),
  );
export const adminCategoryRoutes = Router();
adminCategoryRoutes.use(authenticate, authorize('ADMIN'));
adminCategoryRoutes.get(
  '/',
  run((s) => s.categories(true)),
);
adminCategoryRoutes.post(
  '/',
  run((s, r) => s.saveCategory(categoryInputSchema.parse(r.body)), 201),
);
adminCategoryRoutes.patch(
  '/:id',
  run((s, r) =>
    s.saveCategory(categoryInputSchema.parse(r.body), uuid.parse(r.params.id)),
  ),
);
adminCategoryRoutes.delete(
  '/:id',
  run((s, r) => s.deactivateCategory(uuid.parse(r.params.id))),
);
export const adminTagRoutes = Router();
adminTagRoutes.use(authenticate, authorize('ADMIN'));
adminTagRoutes.get(
  '/',
  run((s) => s.tags()),
);
adminTagRoutes.post(
  '/',
  run((s, r) => s.saveTag(tagInputSchema.parse(r.body)), 201),
);
adminTagRoutes.patch(
  '/:id',
  run((s, r) =>
    s.saveTag(tagInputSchema.parse(r.body), uuid.parse(r.params.id)),
  ),
);
adminTagRoutes.delete(
  '/:id',
  run((s, r) => s.deleteTag(uuid.parse(r.params.id))),
);
export const adminContentRoutes = Router();
adminContentRoutes.use(authenticate, authorize('ADMIN'));
adminContentRoutes.get(
  '/summary',
  run((s) => s.summary()),
);
export const adminMediaRoutes = Router();
adminMediaRoutes.use(authenticate, authorize('ADMIN'));
adminMediaRoutes.get(
  '/',
  list((s, r) => s.media(articleQuerySchema.parse(r.query))),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_r, file, done) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
      done(
        new AppError(400, 'INVALID_IMAGE', 'Choose JPEG, PNG, or WebP images.'),
      );
    else done(null, true);
  },
}).single('file');
adminMediaRoutes.post(
  '/upload',
  rateLimit({
    windowMs: 60000,
    limit: 10,
    keyGenerator: (r) => r.identity!.id,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many uploads. Try again shortly.',
      },
    },
  }),
  (req, res, next) =>
    upload(req, res, (error: unknown) =>
      next(
        error instanceof MulterError
          ? new AppError(
              error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
              'INVALID_IMAGE',
              'Upload one JPEG, PNG, or WebP file up to 5 MB.',
            )
          : error,
      ),
    ),
  run((s, r) => s.upload(r.file), 201),
);
adminMediaRoutes.delete(
  '/:id',
  run((s, r) => s.deleteMedia(uuid.parse(r.params.id))),
);
