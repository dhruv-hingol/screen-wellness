import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, publicKey, secretKey, supabaseConfigured } from './env.js';
import { AppError } from '../utils/app-error.js';
const auth = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
};
let privileged: SupabaseClient | undefined;
export function getAdminClient() {
  if (!supabaseConfigured)
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Supabase is not configured.',
    );
  return (privileged ??= createClient(env.SUPABASE_URL!, secretKey!, { auth }));
}
export function getUserClient(token: string) {
  if (!supabaseConfigured)
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Supabase is not configured.',
    );
  return createClient(env.SUPABASE_URL!, publicKey!, {
    auth,
    global: { headers: { Authorization: 'Bearer ' + token } },
  });
}
