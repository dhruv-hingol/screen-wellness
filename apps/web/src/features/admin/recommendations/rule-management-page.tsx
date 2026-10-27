import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ruleInputSchema,
  assessmentCategories,
  feedbackLabels,
  goalLabels,
  type Rule,
  type RuleInput,
  type Conditions,
} from '@screenwise/shared';
import {
  useAssessmentList,
  useAssessment,
  useAssessmentMutation,
} from '@/features/assessments/hooks/use-assessments';
import { assessmentApi } from '@/features/assessments/services/assessment-api';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import { PageHeader } from '@/components/common/page-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { errorMessage } from '@/lib/errors';
import { useWellnessQuery } from '@/features/prevention/hooks/use-wellness';
import { wellnessApi } from '@/features/prevention/services/wellness-api';
export function RuleManagementPage() {
  const [params, setParams] = useSearchParams();
  const activityId = params.get('activityId') ?? undefined;
  const [editing, setEditing] = useState<Rule | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['rules', page, search, activityId],
    queryFn: () => assessmentApi.rules({ page, search, activityId }),
  });
  const deactivate = useAssessmentMutation((id: string) =>
    assessmentApi.deactivateRule(id),
  );
  return (
    <>
      <PageHeader
        title="Recommendation rules"
        description="Safe conditions evaluated on the backend. Rule edits preserve existing recommendation snapshots."
        action={<Button onClick={() => setEditing(null)}>Create rule</Button>}
      />
      {activityId && (
        <div className="mb-5 flex items-center gap-3 text-sm">
          <span>Showing rules linked to the selected activity.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setParams({});
              setPage(1);
            }}
          >
            Show all rules
          </Button>
        </div>
      )}
      {editing !== undefined && (
        <RuleForm
          key={editing?.id ?? 'new'}
          rule={editing ?? undefined}
          done={() => setEditing(undefined)}
        />
      )}
      <Input
        className="mb-5 max-w-sm"
        aria-label="Search rules"
        placeholder="Search rules"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.rule_name} · revision {r.revision}
                  </TableCell>
                  <TableCell>{r.priority}</TableCell>
                  <TableCell>{r.is_active ? 'Active' : 'Inactive'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={() => setEditing(r)}>
                        Edit / preview
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={!r.is_active || deactivate.isPending}
                        onClick={async () => {
                          try {
                            await deactivate.mutateAsync(r.id);
                            toast.success('Rule deactivated');
                          } catch (e) {
                            toast.error(errorMessage(e));
                          }
                        }}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!query.data.data.length && (
            <p className="p-5 text-sm text-muted-foreground">No rules found.</p>
          )}
          <Pagination
            page={page}
            pages={query.data.meta.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </>
  );
}
type Condition = Conditions['conditions'][number];
const defaults: RuleInput = {
  activity_id: null,
  assessment_id: null,
  rule_name: '',
  conditions: {
    mode: 'all',
    conditions: [{ field: 'score', min: 34, max: 100 }],
  },
  recommendation_title: '',
  recommendation_description: '',
  recommendation_type: 'EYE_COMFORT',
  priority: 2,
  is_active: true,
};
const conditionDefaults: Record<Condition['field'], Condition> = {
  category: { field: 'category', value: 'EYE_COMFORT' },
  score: { field: 'score', min: 0, max: 100 },
  feedback: { field: 'feedback', value: 'Moderate reported concern' },
  answer: { field: 'answer', questionId: '', optionId: '' },
  goal: { field: 'goal', value: 'eye_comfort' },
};
function RuleForm({ rule, done }: { rule?: Rule; done: () => void }) {
  const form = useForm<RuleInput>({
    resolver: zodResolver(ruleInputSchema),
    defaultValues: rule
      ? {
          activity_id: rule.activity_id ?? null,
          assessment_id: rule.assessment_id,
          rule_name: rule.rule_name,
          conditions: rule.conditions,
          recommendation_title: rule.recommendation_title,
          recommendation_description: rule.recommendation_description,
          recommendation_type: rule.recommendation_type,
          priority: rule.priority,
          is_active: rule.is_active,
        }
      : defaults,
  });
  const conditions = useWatch({ control: form.control, name: 'conditions' });
  const assessmentId = useWatch({
    control: form.control,
    name: 'assessment_id',
  });
  const types = useAssessmentList({ pageSize: 100 }, true);
  const activities = useWellnessQuery(['all-activities'], () =>
    wellnessApi.activities({ pageSize: 100 }),
  );
  const assessment = useAssessment(assessmentId ?? '', true);
  const save = useAssessmentMutation((value: RuleInput) =>
    assessmentApi.saveRule(value, rule?.id),
  );
  const update = (index: number, value: Condition) =>
    form.setValue(
      'conditions.conditions',
      conditions.conditions.map((c, i) => (i === index ? value : c)),
      { shouldDirty: true },
    );
  const selectClass = 'h-10 rounded-md border bg-background px-3 text-sm';
  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (value) => {
            try {
              await save.mutateAsync(value);
              toast.success('Rule saved');
              done();
            } catch (e) {
              toast.error(errorMessage(e));
            }
          })}
        >
          <h2 className="text-xl font-semibold">
            {rule ? 'Edit rule' : 'New rule'}
          </h2>
          {(
            [
              'rule_name',
              'recommendation_title',
              'recommendation_description',
            ] as const
          ).map((name) => (
            <label key={name} className="block space-y-2 text-sm">
              {name.replaceAll('_', ' ')}
              {name === 'recommendation_description' ? (
                <Textarea {...form.register(name)} />
              ) : (
                <Input {...form.register(name)} />
              )}
              <FieldError
                message={form.formState.errors[name]?.message}
                className="text-destructive"
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-4">
            <label className="space-y-2 text-sm">
              Assessment
              <select
                className={'block ' + selectClass}
                {...form.register('assessment_id', {
                  setValueAs: (v) => v || null,
                })}
              >
                <option value="">Any assessment</option>
                {types.data?.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Recommendation category
              <select
                className={'block ' + selectClass}
                {...form.register('recommendation_type')}
              >
                {assessmentCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              Priority
              <select
                className={'block ' + selectClass}
                {...form.register('priority', { valueAsNumber: true })}
              >
                <option value="1">High</option>
                <option value="2">Medium</option>
                <option value="3">Low</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...form.register('is_active')} />
            Active
          </label>
          <label className="block space-y-2 text-sm">
            Linked wellness activity (optional)
            <select
              className={'block w-full ' + selectClass}
              {...form.register('activity_id', {
                setValueAs: (v) => v || null,
              })}
            >
              <option value="">No linked activity</option>
              {rule?.activity_id &&
                !activities.data?.data.some(
                  (a) => a.id === rule.activity_id,
                ) && (
                  <option value={rule.activity_id}>
                    Previously linked activity
                  </option>
                )}
              {activities.data?.data.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground">
              Changing only this link preserves recommendation status and
              revision.
            </span>
            {activities.isError && (
              <span role="alert" className="block text-destructive">
                Activities could not load. Retry after applying the Phase 4
                migration.
              </span>
            )}
          </label>
          <label className="block space-y-2 text-sm">
            Match conditions
            <select
              className={'block ' + selectClass}
              {...form.register('conditions.mode')}
            >
              <option value="all">All conditions</option>
              <option value="any">Any condition</option>
            </select>
          </label>
          {conditions.conditions.map((c, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-4"
            >
              <select
                aria-label={'Condition ' + (index + 1) + ' type'}
                value={c.field}
                className={selectClass}
                onChange={(e) =>
                  update(
                    index,
                    conditionDefaults[e.target.value as Condition['field']],
                  )
                }
              >
                {Object.keys(conditionDefaults).map((key) => (
                  <option key={key}>{key}</option>
                ))}
              </select>
              {c.field === 'category' && (
                <select
                  aria-label="Category value"
                  className={selectClass}
                  value={c.value}
                  onChange={(e) =>
                    update(index, {
                      ...c,
                      value: e.target.value as typeof c.value,
                    })
                  }
                >
                  {assessmentCategories.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              )}
              {c.field === 'feedback' && (
                <select
                  aria-label="Feedback value"
                  className={selectClass}
                  value={c.value}
                  onChange={(e) =>
                    update(index, {
                      ...c,
                      value: e.target.value as typeof c.value,
                    })
                  }
                >
                  {feedbackLabels.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              )}
              {c.field === 'goal' && (
                <select
                  aria-label="Wellness interest"
                  className={selectClass}
                  value={c.value}
                  onChange={(e) =>
                    update(index, {
                      ...c,
                      value: e.target.value as typeof c.value,
                    })
                  }
                >
                  {Object.entries(goalLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
              {c.field === 'score' && (
                <>
                  <label className="text-sm">
                    Minimum
                    <Input
                      className="w-24"
                      type="number"
                      min="0"
                      max="100"
                      value={c.min}
                      onChange={(e) =>
                        update(index, { ...c, min: e.target.valueAsNumber })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Maximum
                    <Input
                      className="w-24"
                      type="number"
                      min="0"
                      max="100"
                      value={c.max}
                      onChange={(e) =>
                        update(index, { ...c, max: e.target.valueAsNumber })
                      }
                    />
                  </label>
                </>
              )}
              {c.field === 'answer' && (
                <>
                  <select
                    className={selectClass + ' max-w-full'}
                    aria-label="Question"
                    value={c.questionId}
                    onChange={(e) =>
                      update(index, {
                        ...c,
                        questionId: e.target.value,
                        optionId: '',
                      })
                    }
                  >
                    <option value="">Choose assessment and question</option>
                    {assessment.data?.versions?.flatMap((v) =>
                      v.questions.map((q) => (
                        <option key={q.id} value={q.id}>
                          v{v.version_number}: {q.question_text}
                        </option>
                      )),
                    )}
                  </select>
                  <select
                    className={selectClass}
                    aria-label="Answer option"
                    value={c.optionId}
                    onChange={(e) =>
                      update(index, { ...c, optionId: e.target.value })
                    }
                  >
                    <option value="">Choose answer</option>
                    {assessment.data?.versions?.flatMap((v) =>
                      v.questions
                        .filter((q) => q.id === c.questionId)
                        .flatMap((q) =>
                          q.options.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.option_text}
                            </option>
                          )),
                        ),
                    )}
                  </select>
                </>
              )}
              <Button
                type="button"
                variant="ghost"
                disabled={conditions.conditions.length === 1}
                onClick={() =>
                  form.setValue(
                    'conditions.conditions',
                    conditions.conditions.filter((_, i) => i !== index),
                    { shouldDirty: true },
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={conditions.conditions.length >= 12}
            onClick={() =>
              form.setValue(
                'conditions.conditions',
                [
                  ...conditions.conditions,
                  { field: 'score', min: 0, max: 100 },
                ],
                { shouldDirty: true },
              )
            }
          >
            Add condition
          </Button>
          <details className="text-sm">
            <summary>Preview condition configuration</summary>
            <pre className="mt-3 overflow-auto rounded-md bg-muted p-4 text-xs">
              {JSON.stringify(conditions, null, 2)}
            </pre>
          </details>
          <FormErrors errors={form.formState.errors} />
          <div className="flex gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving...' : 'Save rule'}
            </Button>
            <Button type="button" variant="outline" onClick={done}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
