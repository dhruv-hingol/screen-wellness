import { useState } from 'react';
import { format } from 'date-fns';
import { useWellnessQuery, useWellnessMutation } from '../hooks/use-wellness';
import { wellnessApi } from '../services/wellness-api';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function ActivityHistoryPage() {
  const [page, setPage] = useState(1);
  const query = useWellnessQuery(['history', page], () =>
    wellnessApi.history({ page }),
  );
  const cancel = useWellnessMutation((id: string) =>
    wellnessApi.finish(id, 'CANCELLED'),
  );
  return (
    <>
      <PageHeader
        title="Activity history"
        description="Your confirmed completions and unfinished sessions. Times use your device display timezone."
      />
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Activity</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Elapsed</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.activity_snapshot.title}</TableCell>
                  <TableCell>{format(new Date(s.started_at), 'PPp')}</TableCell>
                  <TableCell>{s.status}</TableCell>
                  <TableCell>
                    {s.duration_seconds === null
                      ? '—'
                      : s.duration_seconds + ' seconds'}
                  </TableCell>
                  <TableCell>
                    {s.status === 'STARTED' && (
                      <Button
                        variant="outline"
                        disabled={cancel.isPending}
                        onClick={async () => {
                          try {
                            await cancel.mutateAsync(s.id);
                            toast.info('Session cancelled');
                          } catch (e) {
                            toast.error(errorMessage(e));
                          }
                        }}
                      >
                        Cancel unfinished session
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pages={query.data.meta.totalPages}
            onChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="No activity sessions yet"
          description="Start an activity from Prevention to begin your history."
        />
      )}
    </>
  );
}
