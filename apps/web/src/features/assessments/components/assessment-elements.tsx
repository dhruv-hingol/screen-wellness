import { Link } from 'react-router';
import type { Assessment, Question } from '@screenwise/shared';
import { ClipboardList } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/page-elements';
import { errorMessage } from '@/lib/errors';
export function AssessmentCard({ assessment: a }: { assessment: Assessment }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <ClipboardList className="text-primary" />
        <Badge variant="secondary">{a.category.replaceAll('_', ' ')}</Badge>
        <h2 className="text-xl font-semibold">{a.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {a.description}
        </p>
        <p className="text-sm">
          {a.question_count} questions · About {a.estimated_minutes} minutes
        </p>
        {a.latest_attempt ? (
          <p className="text-xs text-muted-foreground">
            Last completed{' '}
            {new Date(a.latest_attempt.submitted_at).toLocaleDateString()} ·{' '}
            {a.latest_attempt.feedback_category}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            You have not completed this assessment.
          </p>
        )}
        <Button asChild>
          <Link to={'/assessments/' + a.id}>
            {a.latest_attempt ? 'Retake' : 'Start assessment'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
export function QuestionRenderer({
  question,
  selected,
  onChange,
}: {
  question: Question;
  selected?: string;
  onChange: (id: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-5 text-xl font-semibold">
        {question.question_text}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {question.is_required ? 'Required' : 'Optional'}
        </span>
      </legend>
      {question.options.map((o) => (
        <label
          key={o.id}
          className="flex cursor-pointer items-center gap-3 rounded-xl border p-4 has-checked:border-primary has-checked:bg-primary/5"
        >
          <input
            type="radio"
            name={question.id}
            value={o.id}
            checked={selected === o.id}
            onChange={() => onChange(o.id)}
            className="size-4 accent-indigo-500"
          />
          <span>{o.option_text}</span>
        </label>
      ))}
    </fieldset>
  );
}
export function AssessmentLoading() {
  return (
    <div
      role="status"
      aria-label="Loading assessments"
      className="grid gap-5 sm:grid-cols-2"
    >
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-60 rounded-xl" />
      ))}
    </div>
  );
}
export function QueryError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div role="alert">
      <EmptyState
        title="Unable to load this page"
        description={errorMessage(error)}
      >
        <Button onClick={retry}>Try again</Button>
      </EmptyState>
    </div>
  );
}
export function EducationalNote() {
  return (
    <p className="rounded-xl bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
      This is an educational self-assessment, not a clinically validated
      diagnostic instrument. Scores summarize your answers and do not measure
      disease probability or establish a diagnosis.
    </p>
  );
}
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="my-6 flex items-center justify-between gap-3 text-sm">
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span>
        Page {page} of {Math.max(1, pages)}
      </span>
      <Button
        variant="outline"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
