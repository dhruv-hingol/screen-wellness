import type {
  ApiResponse,
  Page,
  Activity,
  ActivityInput,
  ActivitySession,
  WellnessGoal,
  GoalInput,
  Reminder,
  ReminderInput,
  WellnessNotification,
  DailyChecklist,
} from '@screenwise/shared';
import { api } from '@/services/api';
import { unwrap } from '@/features/assessments/services/assessment-api';
async function paged<T>(
  p: Promise<{ data: ApiResponse<T[]> }>,
): Promise<Page<T>> {
  const { data } = await p;
  if (!data.success) throw new Error(data.error.message);
  return { data: data.data, meta: data.meta! };
}
export const wellnessApi = {
  activities: (params: Record<string, unknown> = {}, admin = false) =>
    paged<Activity>(
      api.get(admin ? '/admin/activities' : '/activities', { params }),
    ),
  activity: (id: string) => unwrap<Activity>(api.get('/activities/' + id)),
  start: (id: string, idempotencyKey: string, source = 'MANUAL') =>
    unwrap<ActivitySession>(
      api.post('/activities/' + id + '/sessions', { idempotencyKey, source }),
    ),
  finish: (id: string, status: 'COMPLETED' | 'CANCELLED') =>
    unwrap<ActivitySession>(
      api.patch('/activities/sessions/' + id, { status }),
    ),
  history: (params: Record<string, unknown>) =>
    paged<ActivitySession>(api.get('/activities/history', { params })),
  today: (params: Record<string, unknown> = {}) =>
    unwrap<DailyChecklist>(api.get('/activities/today', { params })),
  goals: (params: Record<string, unknown> = {}) =>
    paged<WellnessGoal>(api.get('/goals', { params })),
  goal: (id: string) => unwrap<WellnessGoal>(api.get('/goals/' + id)),
  summary: () =>
    unwrap<{ goals: WellnessGoal[]; interests: string[] }>(
      api.get('/goals/summary'),
    ),
  saveGoal: (body: GoalInput, id?: string) =>
    unwrap<WellnessGoal>(
      id ? api.patch('/goals/' + id, body) : api.post('/goals', body),
    ),
  goalStatus: (id: string, status: WellnessGoal['status']) =>
    unwrap<WellnessGoal>(api.patch('/goals/' + id, { status })),
  reminders: () => unwrap<Reminder[]>(api.get('/reminders')),
  saveReminder: (body: ReminderInput, id?: string) =>
    unwrap<Reminder>(
      id ? api.patch('/reminders/' + id, body) : api.post('/reminders', body),
    ),
  deleteReminder: (id: string) =>
    unwrap<{ deleted: boolean }>(api.delete('/reminders/' + id)),
  poll: () => unwrap<WellnessNotification[]>(api.post('/reminders/poll')),
  notifications: (params: Record<string, unknown> = {}) =>
    paged<WellnessNotification>(api.get('/notifications', { params })),
  unread: () =>
    unwrap<{ count: number }>(api.get('/notifications/unread-count')),
  read: (id: string) =>
    unwrap<WellnessNotification>(
      api.patch('/notifications/' + id + '/read', {}),
    ),
  readAll: () =>
    unwrap<{ updated: number }>(api.post('/notifications/read-all')),
  saveActivity: (body: ActivityInput, id?: string) =>
    unwrap<Activity>(
      id
        ? api.patch('/admin/activities/' + id, body)
        : api.post('/admin/activities', body),
    ),
  archiveActivity: (id: string) =>
    unwrap<Activity>(api.delete('/admin/activities/' + id)),
};
