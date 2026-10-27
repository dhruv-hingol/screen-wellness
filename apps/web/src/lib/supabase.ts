import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const optional = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().optional(),
);
const result = z
  .object({
    url: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
    key: optional,
  })
  .safeParse({
    url: import.meta.env.VITE_SUPABASE_URL,
    key:
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY,
  });
export const authConfigured =
  result.success && Boolean(result.data.url && result.data.key);
export const supabase =
  authConfigured && result.success
    ? createClient(result.data.url!, result.data.key!, {
        auth: {
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.sessionStorage,
          storageKey: 'screenwise-auth',
        },
      })
    : null;
export function requireSupabase() {
  if (!supabase)
    throw new Error(
      'Authentication is not configured. Set the Supabase environment variables and restart the app.',
    );
  return supabase;
}
