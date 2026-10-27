import { z } from 'zod';
export const idSchema = z.uuid();
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const nonEmptyText = z.string().trim().min(1).max(500);
