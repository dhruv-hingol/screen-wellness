import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getUserClient } from '../config/supabase.js';
import { AppError } from '../utils/app-error.js';
declare module 'express-serve-static-core' {
  interface Request {
    identity?: { id: string; email: string };
    supabase?: SupabaseClient;
  }
}
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? '');
    if (!match)
      throw new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    const client = getUserClient(match[1]!);
    const { data, error } = await client.auth.getUser(match[1]!);
    if (error || !data.user)
      throw new AppError(
        401,
        'UNAUTHENTICATED',
        'Your session is invalid or expired.',
      );
    if (!data.user.email_confirmed_at)
      throw new AppError(
        403,
        'EMAIL_UNCONFIRMED',
        'Confirm your email before continuing.',
      );
    req.identity = { id: data.user.id, email: data.user.email ?? '' };
    req.supabase = client;
    next();
  } catch (error) {
    next(error);
  }
};
