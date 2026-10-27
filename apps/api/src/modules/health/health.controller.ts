import type { RequestHandler } from 'express';
import type { Health } from '@screenwise/shared';
import { sendSuccess } from '../../utils/response.js';
export const health: RequestHandler = (_req, res) => {
  sendSuccess<Health>(res, { status: 'ok', service: 'screenwise-api' });
};
