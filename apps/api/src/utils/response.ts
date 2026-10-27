import type { Response } from 'express';
import type { ApiResponse } from '@screenwise/shared';
export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res
    .status(status)
    .json({ success: true, data } satisfies ApiResponse<T>);
}
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
  } satisfies ApiResponse<never>);
}
