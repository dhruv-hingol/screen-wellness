import { AppError } from '../utils/app-error.js';
import { MulterError } from 'multer';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';
import { validationIssueMessage } from '@screenwise/shared';
export const notFound: RequestHandler = (_req, res) => {
  sendError(res, 404, 'NOT_FOUND', 'Route not found');
};
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req,
  res,
  _next,
) => {
  if (error instanceof AppError) {
    sendError(res, error.status, error.code, error.message);
    return;
  }
  if (error instanceof MulterError) {
    sendError(
      res,
      error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
      'INVALID_UPLOAD',
      req.originalUrl.includes('/admin/media')
        ? 'Upload one PNG, JPEG, or WebP image up to 5 MB.'
        : 'Upload one PNG, JPEG, or WebP image up to 2 MB.',
    );
    return;
  }
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      path: issue.path,
      message: validationIssueMessage(issue),
      code: issue.code,
    }));
    sendError(
      res,
      400,
      'VALIDATION_ERROR',
      issues[0]?.message ?? 'Check the highlighted fields and try again.',
      issues,
    );
    return;
  }
  if (
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400
  ) {
    sendError(
      res,
      400,
      'INVALID_JSON',
      'This request could not be read. Reload the page and try again.',
    );
    return;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 413
  ) {
    sendError(
      res,
      413,
      'PAYLOAD_TOO_LARGE',
      'This form contains too much data. Shorten the content and try again.',
    );
    return;
  }
  logger.error({ err: error }, 'Request failed');
  sendError(
    res,
    500,
    'INTERNAL_ERROR',
    'ScreenWise could not complete this request. Please try again.',
  );
};
