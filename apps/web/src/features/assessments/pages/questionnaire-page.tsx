import { FieldError } from '@/components/common/form-errors';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import type { Assessment } from '@screenwise/shared';
import { useAssessment, useAssessmentMutation } from '../hooks/use-assessments';
import { assessmentApi } from '../services/assessment-api';
import {
  QuestionRenderer,
  EducationalNote,
  AssessmentLoading,
  QueryError,
} from '../components/assessment-elements';
import { PageHeader } from '@/components/common/page-elements';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
export function QuestionnairePage() {
  const { id = '' } = useParams();
  const query = useAssessment(id);
  if (query.isPending) return <AssessmentLoading />;
  if (query.isError)
    return (
      <QueryError error={query.error} retry={() => void query.refetch()} />
    );
  return <Questionnaire key={query.data.version!.id} assessment={query.data} />;
}
function Questionnaire({ assessment }: { assessment: Assessment }) {
  const version = assessment.version!;
  const questions = version.questions;
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const retry = useRef({ key: crypto.randomUUID(), payload: '' });
  const submitting = useRef(false);
  const schema = z
    .object({ answers: z.record(z.string(), z.string().optional()) })
    .superRefine((data, ctx) => {
      for (const q of questions)
        if (q.is_required && !data.answers[q.id])
          ctx.addIssue({
            code: 'custom',
            path: ['answers', q.id],
            message: 'Choose an answer to continue.',
          });
    });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { answers: {} as Record<string, string | undefined> },
  });
  const answers = useWatch({ control: form.control, name: 'answers' });
  const mutation = useAssessmentMutation(
    (body: Parameters<typeof assessmentApi.submit>[1]) =>
      assessmentApi.submit(assessment.id, body),
  );
  const current = questions[step];
  async function next() {
    if (current?.is_required && !answers[current.id]) {
      form.setError(('answers.' + current.id) as `answers.${string}`, {
        message: 'Choose an answer to continue.',
      });
      return;
    }
    setError('');
    setStep((s) => s + 1);
  }
  const submit = async (values: {
    answers: Record<string, string | undefined>;
  }) => {
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    const responses = Object.entries(values.answers)
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([questionId, selectedOptionId]) => ({
        questionId,
        selectedOptionId,
      }));
    const payload = JSON.stringify(responses);
    if (retry.current.payload && retry.current.payload !== payload)
      retry.current.key = crypto.randomUUID();
    retry.current.payload = payload;
    try {
      const result = await mutation.mutateAsync({
        assessmentVersionId: version.id,
        idempotencyKey: retry.current.key,
        responses,
      });
      navigate('/assessments/results/' + result.id, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      submitting.current = false;
    }
  };
  return (
    <>
      <PageHeader
        title={assessment.title}
        description={assessment.description}
      />
      <EducationalNote />
      <Card className="mx-auto mt-7 max-w-3xl">
        <CardContent className="p-6 sm:p-9">
          <p className="mb-3 text-sm text-muted-foreground">
            Version {version.version_number} ·{' '}
            {current
              ? 'Question ' + (step + 1) + ' of ' + questions.length
              : 'Review your answers'}
          </p>
          <Progress
            value={
              (Math.min(step + 1, questions.length) / questions.length) * 100
            }
            aria-label="Questionnaire progress"
          />
          <form
            onSubmit={(event) => void form.handleSubmit(submit)(event)}
            className="mt-8"
          >
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {current ? (
                <>
                  <QuestionRenderer
                    question={current}
                    selected={answers[current.id]}
                    onChange={(value) => {
                      form.setValue(
                        ('answers.' + current.id) as `answers.${string}`,
                        value,
                      );
                      form.clearErrors(
                        ('answers.' + current.id) as `answers.${string}`,
                      );
                    }}
                  />
                  <FieldError
                    message={
                      form.formState.errors.answers?.[current.id]?.message
                    }
                    className="mt-3 text-sm text-destructive"
                  />
                </>
              ) : (
                <div className="space-y-5">
                  <h2 className="text-xl font-semibold">Ready to submit?</h2>
                  {questions.map((q, index) => (
                    <div key={q.id} className="rounded-lg border p-4">
                      <p className="text-sm font-medium">{q.question_text}</p>
                      <p className="my-2 text-sm text-muted-foreground">
                        {q.options.find((o) => o.id === answers[q.id])
                          ?.option_text ?? 'Skipped (optional)'}
                      </p>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => setStep(index)}
                      >
                        Edit answer
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
            {error && (
              <p role="alert" className="my-5 text-sm text-destructive">
                {error} Your answers are still here; retry when the
                connection/session is restored.
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0 || mutation.isPending}
                onClick={() => setStep((s) => s - 1)}
              >
                Previous
              </Button>
              {current ? (
                <Button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => void next()}
                >
                  {step === questions.length - 1 ? 'Review answers' : 'Next'}
                </Button>
              ) : (
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending
                    ? 'Saving result...'
                    : 'Submit assessment'}
                </Button>
              )}
            </div>
          </form>
          <p className="mt-5 text-xs text-muted-foreground">
            Answers stay in this page only until submitted. Refreshing or
            leaving may discard unsaved answers.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
