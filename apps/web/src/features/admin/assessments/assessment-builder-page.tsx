import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  useForm,
  useFieldArray,
  useWatch,
  type UseFormRegister,
  type Control,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  assessmentCategories,
  metadataSchema,
  definitionSchema,
  type AssessmentMetadata,
  type Definition,
  type Assessment,
} from '@screenwise/shared';
import {
  useAssessment,
  useAssessmentMutation,
} from '@/features/assessments/hooks/use-assessments';
import { assessmentApi } from '@/features/assessments/services/assessment-api';
import {
  AssessmentLoading,
  QueryError,
  QuestionRenderer,
} from '@/features/assessments/components/assessment-elements';
import { PageHeader } from '@/components/common/page-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { errorMessage } from '@/lib/errors';
const defaultConfig = {
  compatibilityKey: 'computed-on-publication',
  bands: [
    {
      min: 0,
      label: 'Lower reported concern' as const,
      explanation:
        'Your answers describe fewer concerns in this topic. Keep reflecting on habits that support you.',
    },
    {
      min: 34,
      label: 'Moderate reported concern' as const,
      explanation:
        'Your answers describe some concerns. Consider small, manageable changes that fit your routine.',
    },
    {
      min: 67,
      label: 'Higher reported concern' as const,
      explanation:
        'Your answers describe more frequent concerns. Review supportive habits and seek qualified advice for persistent discomfort.',
    },
  ],
};
function newQuestion() {
  return {
    id: crypto.randomUUID(),
    question_text: '',
    question_type: 'single_choice' as const,
    is_required: true,
    options: ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often'].map(
      (option_text, score) => ({ id: crypto.randomUUID(), option_text, score }),
    ),
  };
}
export function AssessmentBuilderPage() {
  const { id } = useParams();
  if (!id)
    return (
      <>
        <PageHeader
          title="Create assessment"
          description="Save the assessment metadata, then build its first draft."
        />
        <MetadataForm />
      </>
    );
  return <EditAssessment id={id} />;
}
function MetadataForm({ assessment }: { assessment?: Assessment }) {
  const navigate = useNavigate();
  const form = useForm<AssessmentMetadata>({
    resolver: zodResolver(metadataSchema),
    defaultValues: assessment
      ? {
          title: assessment.title,
          slug: assessment.slug,
          description: assessment.description,
          category: assessment.category,
          estimated_minutes: assessment.estimated_minutes,
        }
      : {
          title: '',
          slug: '',
          description: '',
          category: 'EYE_COMFORT',
          estimated_minutes: 5,
        },
  });
  const mutation = useAssessmentMutation((v: AssessmentMetadata) =>
    assessment
      ? assessmentApi.metadata(assessment.id, v)
      : assessmentApi.create(v),
  );
  return (
    <form
      className="mb-8 space-y-4 rounded-xl border bg-card p-6"
      onSubmit={form.handleSubmit(async (v) => {
        try {
          const a = await mutation.mutateAsync(v);
          toast.success('Assessment metadata saved');
          if (!assessment) navigate('/admin/assessments/' + a.id + '/edit');
        } catch (e) {
          toast.error(errorMessage(e));
        }
      })}
    >
      {(['title', 'slug', 'description'] as const).map((name) => (
        <label key={name} className="block space-y-2 text-sm">
          {name[0]!.toUpperCase() + name.slice(1)}
          {name === 'description' ? (
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
      <label className="block space-y-2 text-sm">
        Category
        <select
          className="block h-10 rounded-md border bg-background px-3"
          {...form.register('category')}
        >
          {assessmentCategories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="block space-y-2 text-sm">
        Estimated minutes
        <Input
          type="number"
          min="1"
          max="60"
          {...form.register('estimated_minutes', { valueAsNumber: true })}
        />
        <FieldError
          message={form.formState.errors.estimated_minutes?.message}
          className="text-destructive"
        />
      </label>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving...' : 'Save metadata'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Past result metadata stays in its original snapshot.
      </p>
    </form>
  );
}
function EditAssessment({ id }: { id: string }) {
  const query = useAssessment(id, true);
  const draft = useAssessmentMutation(() => assessmentApi.draft(id));
  const archive = useAssessmentMutation(() => assessmentApi.archive(id));
  if (query.isPending) return <AssessmentLoading />;
  if (query.isError)
    return (
      <QueryError error={query.error} retry={() => void query.refetch()} />
    );
  const a = query.data;
  const v = a.versions?.find((v) => v.status === 'draft');
  return (
    <>
      <PageHeader
        title={a.title}
        description="Published content is immutable. Start a new draft to change questions."
      />
      <MetadataForm assessment={a} />
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <p className="text-sm">
          Status: {a.status} · Versions:{' '}
          {a.versions
            ?.map((v) => v.version_number + ' (' + v.status + ')')
            .join(', ')}
        </p>
        {!v && (
          <Button
            disabled={draft.isPending}
            onClick={async () => {
              try {
                await draft.mutateAsync();
                toast.success('Draft created with new question identifiers');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            Create new draft version
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={a.status === 'archived' || archive.isPending}
            >
              Archive assessment
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive this assessment?</AlertDialogTitle>
              <AlertDialogDescription>
                New submissions will stop. Existing results remain available.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await archive.mutateAsync();
                    toast.success('Archived');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {v && <DraftBuilder key={v.id + ':' + v.draft_revision} assessment={a} />}
    </>
  );
}
function DraftBuilder({ assessment }: { assessment: Assessment }) {
  const v = assessment.versions!.find((v) => v.status === 'draft')!;
  const [preview, setPreview] = useState(false);
  const form = useForm<Definition>({
    resolver: zodResolver(definitionSchema),
    defaultValues: {
      scoring_config: v.scoring_config?.bands
        ? v.scoring_config
        : defaultConfig,
      questions: v.questions.length
        ? v.questions.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type,
            is_required: q.is_required,
            options: q.options.map((o) => ({
              id: o.id,
              option_text: o.option_text,
              score: o.score!,
            })),
          }))
        : [newQuestion()],
    },
  });
  const fields = useFieldArray({
    control: form.control,
    name: 'questions',
    keyName: 'fieldId',
  });
  const values = useWatch({ control: form.control });
  const save = useAssessmentMutation((data: Definition) =>
    assessmentApi.save(assessment.id, { ...data, revision: v.draft_revision }),
  );
  const publish = useAssessmentMutation(() =>
    assessmentApi.publish(assessment.id, v.draft_revision),
  );
  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="text-xl font-semibold">
            Draft version {v.version_number}
          </h2>
          <Button variant="outline" onClick={() => setPreview(!preview)}>
            {preview ? 'Back to builder' : 'Preview questionnaire'}
          </Button>
        </div>
        {preview ? (
          <div className="space-y-8">
            {(values.questions ?? []).map((q, i) => (
              <PreviewQuestion
                key={q.id}
                question={{
                  id: q.id!,
                  question_text: q.question_text!,
                  question_type: 'single_choice',
                  is_required: q.is_required!,
                  display_order: i + 1,
                  options: (q.options ?? []).map((o, j) => ({
                    id: o.id!,
                    option_text: o.option_text!,
                    display_order: j + 1,
                  })),
                }}
              />
            ))}
            <p className="text-sm text-muted-foreground">
              Preview only. No assessment is submitted.
            </p>
          </div>
        ) : (
          <form
            className="space-y-6"
            onSubmit={form.handleSubmit(async (data) => {
              try {
                await save.mutateAsync(data);
                toast.success('Draft saved');
              } catch (e) {
                toast.error(errorMessage(e));
              }
            })}
          >
            {fields.fields.map((q, index) => (
              <section
                key={q.fieldId}
                className="space-y-4 rounded-xl border p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Question {index + 1}</h3>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => fields.move(index, index - 1)}
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={index === fields.fields.length - 1}
                      onClick={() => fields.move(index, index + 1)}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={fields.fields.length === 1}
                      onClick={() => fields.remove(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                <label className="block text-sm">
                  Question text
                  <Textarea
                    className="mt-2"
                    {...form.register(`questions.${index}.question_text`)}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    {...form.register(`questions.${index}.is_required`)}
                  />
                  Required
                </label>
                <OptionEditor
                  index={index}
                  control={form.control}
                  register={form.register}
                />
              </section>
            ))}
            <Button
              type="button"
              variant="outline"
              disabled={fields.fields.length >= 50}
              onClick={() => fields.append(newQuestion())}
            >
              Add question
            </Button>
            <section className="space-y-4">
              <h3 className="font-semibold">Educational feedback bands</h3>
              <p className="text-sm text-muted-foreground">
                Higher answer scores must always indicate more concerns.
                Reverse-score healthy habits. Bands start at 0 and increase.
                Compatibility is computed from the published definition.
              </p>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[120px_1fr]"
                >
                  <label className="text-sm">
                    Minimum %
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      {...form.register(`scoring_config.bands.${i}.min`, {
                        valueAsNumber: true,
                      })}
                    />
                  </label>
                  <label className="text-sm">
                    Feedback label
                    <select
                      className="block h-10 w-full rounded-md border bg-background px-3"
                      {...form.register(`scoring_config.bands.${i}.label`)}
                    >
                      {defaultConfig.bands.map((b) => (
                        <option key={b.label}>{b.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Explanation
                    <Textarea
                      {...form.register(
                        `scoring_config.bands.${i}.explanation`,
                      )}
                    />
                  </label>
                </div>
              ))}
            </section>
            <FormErrors errors={form.formState.errors} />
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving...' : 'Save draft'}
            </Button>
          </form>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              disabled={
                form.formState.isDirty ||
                !v.questions.length ||
                save.isPending ||
                publish.isPending
              }
            >
              Publish saved draft
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Publish version {v.version_number}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Only the saved draft will publish. It becomes immutable and
                replaces the current version for new submissions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await publish.mutateAsync();
                    toast.success('Version published');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                Publish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <p className="text-xs text-muted-foreground">
          Save changes before publishing. Publishing never changes previous
          results.
        </p>
      </CardContent>
    </Card>
  );
}
function OptionEditor({
  index,
  control,
  register,
}: {
  index: number;
  control: Control<Definition>;
  register: UseFormRegister<Definition>;
}) {
  const fields = useFieldArray({
    control,
    name: `questions.${index}.options`,
    keyName: 'fieldId',
  });
  return (
    <div className="space-y-3">
      {fields.fields.map((o, j) => (
        <div key={o.fieldId} className="flex flex-wrap items-end gap-2">
          <label className="min-w-36 flex-1 text-sm">
            Answer {j + 1}
            <Input
              {...register(`questions.${index}.options.${j}.option_text`)}
            />
          </label>
          <label className="w-24 text-sm">
            Score
            <Input
              type="number"
              min="0"
              max="100"
              {...register(`questions.${index}.options.${j}.score`, {
                valueAsNumber: true,
              })}
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            disabled={fields.fields.length <= 2}
            onClick={() => fields.remove(j)}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={fields.fields.length >= 10}
        onClick={() =>
          fields.append({ id: crypto.randomUUID(), option_text: '', score: 0 })
        }
      >
        Add answer option
      </Button>
    </div>
  );
}

function PreviewQuestion({
  question,
}: {
  question: Parameters<typeof QuestionRenderer>[0]['question'];
}) {
  const [selected, setSelected] = useState<string>();
  return (
    <QuestionRenderer
      question={question}
      selected={selected}
      onChange={setSelected}
    />
  );
}
