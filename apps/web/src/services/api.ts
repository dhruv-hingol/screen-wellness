import { supabase } from '@/lib/supabase';
import axios from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import { API_PREFIX, type ApiResponse, type Health } from '@screenwise/shared';
export const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    API_PREFIX,
  timeout: 10000,
  headers: { Accept: 'application/json' },
});
export const queryKeys = {
  health: ['system', 'health'] as const,
  dashboard: {
    all: ['dashboard'] as const,
    summary: (userId: string) => ['dashboard', userId, 'summary'] as const,
    recommendations: (userId: string) =>
      ['dashboard', userId, 'recommendations'] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    personal: (userId: string, filters: object) =>
      ['analytics', userId, filters] as const,
  },
  adminAnalytics: {
    all: ['admin-analytics'] as const,
    dashboard: (userId: string, filters: object) =>
      ['admin-analytics', userId, filters] as const,
  },
};
export async function getHealth() {
  const { data } = await api.get<ApiResponse<Health>>('/health');
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}
export function invalidateAnalyticsQueries(cache: QueryClient) {
  return Promise.all(
    [
      queryKeys.dashboard.all,
      queryKeys.analytics.all,
      queryKeys.adminAnalytics.all,
    ].map((queryKey) => cache.invalidateQueries({ queryKey })),
  );
}

api.interceptors.request.use(async (config) => {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});
