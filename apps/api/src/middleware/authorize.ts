import type { RequestHandler } from 'express';
import { AppError } from '../utils/app-error.js';
export const authorize =
  (role: 'ADMIN' | 'USER'): RequestHandler =>
  async (req, _res, next) => {
    try {
      if (!req.identity || !req.supabase)
        throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
      const { data, error } = await req.supabase
        .from('profiles')
        .select('role')
        .eq('id', req.identity.id)
        .single();
      if (error)
        throw new AppError(
          503,
          'PROFILE_UNAVAILABLE',
          'Unable to verify account permissions.',
        );
      if (data.role !== role)
        throw new AppError(
          403,
          'FORBIDDEN',
          'You do not have access to this resource.',
        );
      next();
    } catch (error) {
      next(error);
    }
  };
