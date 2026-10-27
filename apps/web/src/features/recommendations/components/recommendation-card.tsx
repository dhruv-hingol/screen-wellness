import { Link } from 'react-router';
import type { Recommendation } from '@screenwise/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAssessmentMutation } from '@/features/assessments/hooks/use-assessments';
import { assessmentApi } from '@/features/assessments/services/assessment-api';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function RecommendationCard({
  recommendation: r,
}: {
  recommendation: Recommendation;
}) {
  const mutation = useAssessmentMutation((status: Recommendation['status']) =>
    assessmentApi.status(r.id, status),
  );
  const s = r.content_snapshot;
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{s.type.replaceAll('_', ' ')}</Badge>
          <Badge variant="outline">
            {
              ['', 'High priority', 'Medium priority', 'Low priority'][
                s.priority
              ]
            }
          </Badge>
          <Badge variant="outline">{r.status}</Badge>
        </div>
        <h3 className="text-lg font-semibold">{s.title}</h3>
        <p className="text-sm leading-relaxed">{s.description}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{s.why}</p>
        {r.activity_title && (
          <p className="text-sm">Related activity: {r.activity_title}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link
              to={
                '/library?search=' +
                {
                  EYE_COMFORT: 'eye',
                  POSTURE: 'posture',
                  SLEEP: 'sleep',
                  DIGITAL_FATIGUE: 'digital',
                }[s.type]
              }
            >
              Explore related articles
            </Link>
          </Button>
          {r.activity_id && (
            <Button asChild>
              <Link
                to={
                  '/prevention/' + r.activity_id + '?recommendationId=' + r.id
                }
              >
                Start related activity
              </Link>
            </Button>
          )}
          {(['active', 'completed', 'dismissed'] as const)
            .filter((status) => status !== r.status)
            .map((status) => (
              <Button
                key={status}
                variant="outline"
                disabled={mutation.isPending}
                onClick={async () => {
                  try {
                    await mutation.mutateAsync(status);
                    toast.success('Recommendation updated');
                  } catch (e) {
                    toast.error(errorMessage(e));
                  }
                }}
              >
                {status === 'active'
                  ? 'Restore'
                  : status === 'completed'
                    ? 'Mark completed'
                    : 'Dismiss'}
              </Button>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
