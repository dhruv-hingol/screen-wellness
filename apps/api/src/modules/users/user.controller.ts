import type { Request, RequestHandler } from 'express';
import {
  profilePatchSchema,
  preferencesPatchSchema,
  onboardingSchema,
  goalsBodySchema,
} from '@screenwise/shared';
import { UserRepository } from './user.repository.js';
import { UserService } from './user.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/app-error.js';
function service(req: Request) {
  if (!req.identity || !req.supabase)
    throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  return new UserService(
    new UserRepository(req.identity.id, req.supabase),
    req.identity.id,
  );
}
const action =
  (run: (s: UserService, req: Request) => Promise<unknown>): RequestHandler =>
  async (req, res, next) => {
    try {
      sendSuccess(res, await run(service(req), req));
    } catch (error) {
      next(error);
    }
  };
export const getProfile = action((s) => s.profile());
export const patchProfile = action((s, r) =>
  s.updateProfile(profilePatchSchema.parse(r.body)),
);
export const getPreferences = action((s) => s.preferences());
export const patchPreferences = action((s, r) =>
  s.updatePreferences(preferencesPatchSchema.parse(r.body)),
);
export const getOnboarding = action((s) => s.onboarding());
export const postOnboarding = action((s, r) =>
  s.submitOnboarding(onboardingSchema.parse(r.body)),
);
export const getGoals = action((s) => s.goals());
export const putGoals = action((s, r) =>
  s.replaceGoals(goalsBodySchema.parse(r.body).goals),
);
export const uploadAvatar = action((s, r) => s.avatar(r.file));
