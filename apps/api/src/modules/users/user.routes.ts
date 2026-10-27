import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate.js';
import { AppError } from '../../utils/app-error.js';
import * as controller from './user.controller.js';
export const userRoutes = Router();
userRoutes.use(
  rateLimit({
    windowMs: 60000,
    limit: 120,
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
  authenticate,
);
userRoutes
  .route('/me')
  .get(controller.getProfile)
  .patch(controller.patchProfile);
userRoutes
  .route('/preferences')
  .get(controller.getPreferences)
  .patch(controller.patchPreferences);
userRoutes
  .route('/onboarding')
  .get(controller.getOnboarding)
  .post(controller.postOnboarding);
userRoutes
  .route('/wellness-goals')
  .get(controller.getGoals)
  .put(controller.putGoals);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter: (_req, file, done) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
      done(new AppError(400, 'INVALID_FILE', 'Use PNG, JPEG, or WebP images.'));
      return;
    }
    done(null, true);
  },
});
userRoutes.post(
  '/avatar',
  rateLimit({
    windowMs: 60000,
    limit: 10,
    keyGenerator: (req) => req.identity!.id,
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
  upload.single('avatar'),
  controller.uploadAvatar,
);
