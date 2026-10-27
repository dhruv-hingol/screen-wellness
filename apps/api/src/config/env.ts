import 'dotenv/config';
import { z } from 'zod';
const optional = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().min(1).optional(),
);
export const env = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    ARTICLE_READING_WORDS_PER_MINUTE: z.coerce
      .number()
      .int()
      .min(100)
      .max(500)
      .default(200),
    FRONTEND_URL: z.url().default('http://localhost:5173'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SUPABASE_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.url().optional(),
    ),
    SUPABASE_PUBLISHABLE_KEY: optional,
    SUPABASE_SECRET_KEY: optional,
    SUPABASE_ANON_KEY: optional,
    SUPABASE_SERVICE_ROLE_KEY: optional,
  })
  .parse({
    ...process.env,
    FRONTEND_URL: process.env.FRONTEND_URL || process.env.WEB_ORIGIN,
  });
export const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
export const secretKey =
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseConfigured = Boolean(
  env.SUPABASE_URL && publicKey && secretKey,
);
if (env.NODE_ENV === 'production' && !supabaseConfigured)
  throw new Error('Supabase configuration is required in production');
