import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-provider';
import { useAssessmentMutation } from '@/features/assessments/hooks/use-assessments';
import { assessmentApi } from '@/features/assessments/services/assessment-api';
import { RecommendationCard } from '../components/recommendation-card';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
  EducationalNote,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function WellnessPlanPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['recommendations', user?.id, status, page],
    queryFn: () => assessmentApi.plan({ status, page }),
  });
  const refresh = useAssessmentMutation(() => assessmentApi.refresh());
  return (
    <>
      <PageHeader
        title="Your wellness plan"
        description="Supportive suggestions based on your assessment answers and chosen wellness interests."
        action={
          <Button
            variant="outline"
            disabled={refresh.isPending}
            onClick={async () => {
              try {
                const r = await refresh.mutateAsync();
                toast.success(
                  'Reviewed ' + r.evaluatedAssessments + ' assessment topics.',
                );
              } catch (e) {
                toast.error(errorMessage(e));
              }
            }}
          >
            {refresh.isPending ? 'Refreshing...' : 'Refresh suggestions'}
          </Button>
        }
      />
      <EducationalNote />
      <div className="my-6 flex gap-3">
        {['active', 'completed', 'dismissed'].map((s) => (
          <Button
            key={s}
            variant={s === status ? 'default' : 'outline'}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s[0]!.toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {query.data.data.map((r) => (
              <RecommendationCard key={r.id} recommendation={r} />
            ))}
          </div>
          <Pagination
            page={page}
            pages={query.data.meta.totalPages}
            onChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          title={'No ' + status + ' recommendations'}
          description="Complete an assessment to receive matching guidance. Completed or dismissed suggestions stay in their own history until you restore them."
        />
      )}
    </>
  );
}
