import { Link, useParams } from 'react-router';
import { useAttempt } from '../hooks/use-assessments';
import {
  AssessmentLoading,
  QueryError,
  EducationalNote,
} from '../components/assessment-elements';
import { RecommendationCard } from '@/features/recommendations/components/recommendation-card';
import { PageHeader } from '@/components/common/page-elements';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
export function AssessmentResultPage() {
  const { attemptId = '' } = useParams();
  const query = useAttempt(attemptId);
  if (query.isPending) return <AssessmentLoading />;
  if (query.isError)
    return (
      <QueryError error={query.error} retry={() => void query.refetch()} />
    );
  const a = query.data;
  return (
    <>
      <PageHeader
        title={a.assessment_title + ' results'}
        description={
          new Date(a.submitted_at).toLocaleString() +
          ' · Questionnaire version ' +
          a.version_number
        }
        action={
          <Button asChild variant="outline">
            <Link to="/assessments/history">Assessment history</Link>
          </Button>
        }
      />
      <Card className="mb-7">
        <CardContent className="grid gap-8 p-7 sm:grid-cols-[180px_1fr]">
          <div className="flex size-40 items-center justify-center rounded-full border-[12px] border-primary/20 text-center">
            <div>
              <p className="text-4xl font-semibold text-primary">
                {a.normalized_score}
              </p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">{a.feedback_category}</h2>
            <p className="leading-relaxed text-muted-foreground">
              {a.explanation}
            </p>
            <Progress
              value={a.normalized_score}
              aria-label="Reported concern score"
            />
            <p className="text-xs text-muted-foreground">
              Higher scores reflect more reported concerns in these answers. Raw
              score: {a.total_score} (answered-item range {a.minimum_score}–
              {a.maximum_score}).
            </p>
          </div>
        </CardContent>
      </Card>
      <EducationalNote />
      <h2 className="mb-5 mt-8 text-xl font-semibold">
        Suggestions for your next steps
      </h2>
      {a.recommendations?.length ? (
        <div className="grid gap-5 md:grid-cols-2">
          {a.recommendations.map((r) => (
            <RecommendationCard key={r.id} recommendation={r} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">
          No matching suggestions were generated for these answers.
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link to={'/assessments/' + a.assessment_id}>
            Retake latest questionnaire
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/wellness-plan">View wellness plan</Link>
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Retakes use the currently published version, when available. Your saved
        result is never recalculated.
      </p>
    </>
  );
}
