import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
// Parsed input is deliberately separate from Express query getters.
export const validate =
  (
    schema: ZodType,
    source: 'body' | 'query' | 'params' = 'body',
  ): RequestHandler =>
  (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error);
      return;
    }
    res.locals.validated = result.data;
    next();
  };
