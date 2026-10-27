import type {
  ApiResponse,
  Assessment,
  Attempt,
  Page,
  Submission,
  TrendGroup,
  AssessmentMetadata,
  Definition,
  Rule,
  RuleInput,
  Recommendation,
} from '@screenwise/shared';
import { api } from '@/services/api';
export async function unwrap<T>(request: Promise<{ data: ApiResponse<T> }>) {
  const { data } = await request;
  if (!data.success) throw new Error(data.error.message);
  return data.data;
}
async function paged<T>(
  request: Promise<{ data: ApiResponse<T[]> }>,
): Promise<Page<T>> {
  const { data } = await request;
  if (!data.success) throw new Error(data.error.message);
  return { data: data.data, meta: data.meta! };
}
export const assessmentApi = {
  list: (params: Record<string, unknown>) =>
    paged<Assessment>(api.get('/assessments', { params })),
  detail: (id: string) => unwrap<Assessment>(api.get('/assessments/' + id)),
  submit: (id: string, payload: Submission) =>
    unwrap<Attempt>(api.post('/assessments/' + id + '/submit', payload)),
  result: (id: string) =>
    unwrap<Attempt>(api.get('/assessments/attempts/' + id)),
  history: (params: Record<string, unknown>) =>
    paged<Attempt>(api.get('/assessments/history', { params })),
  trends: (id: string) =>
    unwrap<TrendGroup[]>(api.get('/assessments/' + id + '/trends')),
  adminList: (params: Record<string, unknown>) =>
    paged<Assessment>(api.get('/admin/assessments', { params })),
  adminDetail: (id: string) =>
    unwrap<Assessment>(api.get('/admin/assessments/' + id)),
  create: (body: AssessmentMetadata) =>
    unwrap<Assessment>(api.post('/admin/assessments', body)),
  metadata: (id: string, body: AssessmentMetadata) =>
    unwrap<Assessment>(api.patch('/admin/assessments/' + id, body)),
  draft: (id: string) =>
    unwrap<Assessment>(api.post('/admin/assessments/' + id + '/drafts')),
  save: (id: string, body: Definition & { revision: number }) =>
    unwrap<Assessment>(api.put('/admin/assessments/' + id + '/draft', body)),
  publish: (id: string, revision: number) =>
    unwrap<Assessment>(
      api.post('/admin/assessments/' + id + '/publish', { revision }),
    ),
  archive: (id: string) =>
    unwrap<Assessment>(api.post('/admin/assessments/' + id + '/archive')),
  rules: (params: Record<string, unknown>) =>
    paged<Rule>(api.get('/admin/recommendations', { params })),
  saveRule: (body: RuleInput, id?: string) =>
    unwrap<Rule>(
      id
        ? api.patch('/admin/recommendations/' + id, body)
        : api.post('/admin/recommendations', body),
    ),
  deactivateRule: (id: string) =>
    unwrap<Rule>(api.delete('/admin/recommendations/' + id)),
  plan: (params: Record<string, unknown>) =>
    paged<Recommendation>(api.get('/recommendations/me', { params })),
  status: (id: string, status: Recommendation['status']) =>
    unwrap<Recommendation>(api.patch('/recommendations/' + id, { status })),
  refresh: () =>
    unwrap<{ evaluatedAssessments: number }>(
      api.post('/recommendations/refresh'),
    ),
};
