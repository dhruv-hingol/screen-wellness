import { useState } from 'react';
import { Link } from 'react-router';
import {
  useHistory,
  useTrends,
  useAssessmentList,
} from '../hooks/use-assessments';
import { AssessmentTrendChart } from '../components/assessment-trend-chart';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '../components/assessment-elements';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
export function AssessmentHistoryPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const query = useHistory({
    page,
    from: from || undefined,
    to: to || undefined,
    assessmentId: assessmentId || undefined,
  });
  const types = useAssessmentList({ pageSize: 100 });
  const trends = useTrends(assessmentId);
  return (
    <>
      <PageHeader
        title="Your assessment history"
        description="Your saved answers and results, linked to their original questionnaire versions."
        action={
          <Button asChild variant="outline">
            <Link to="/assessments">All assessments</Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-4">
        <label className="space-y-2 text-sm">
          From (UTC)
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="space-y-2 text-sm">
          To (UTC)
          <Input
            type="date"
            min={from}
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="space-y-2 text-sm">
          Assessment
          <select
            className="block h-10 rounded-md border bg-background px-3"
            value={assessmentId}
            onChange={(e) => {
              setAssessmentId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All assessments</option>
            {[
              ...new Map(
                [
                  ...(types.data?.data ?? []),
                  ...(query.data?.data ?? []).map((a) => ({
                    id: a.assessment_id,
                    title: a.assessment_title,
                  })),
                ].map((a) => [a.id, a]),
              ).values(),
            ].map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'Assessment',
                  'Category',
                  'Completed',
                  'Score',
                  'Feedback',
                  'Result',
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.assessment_title}</TableCell>
                  <TableCell>{a.category.replaceAll('_', ' ')}</TableCell>
                  <TableCell>
                    {new Date(a.submitted_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{a.normalized_score}/100</TableCell>
                  <TableCell>{a.feedback_category}</TableCell>
                  <TableCell>
                    <Link
                      className="text-primary underline"
                      to={'/assessments/results/' + a.id}
                    >
                      View result
                    </Link>
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
          title="No results for this selection"
          description="Complete an assessment or change the date filters to see your history."
        />
      )}
      <h2 className="my-7 text-xl font-semibold">Your saved score trends</h2>
      {!assessmentId ? (
        <p className="text-sm text-muted-foreground">
          Select an assessment above. Incompatible questionnaire definitions are
          shown in separate groups. Charts show all recorded dates for that
          assessment.
        </p>
      ) : trends.isPending ? (
        <AssessmentLoading />
      ) : trends.isError ? (
        <QueryError error={trends.error} retry={() => void trends.refetch()} />
      ) : (
        <AssessmentTrendChart groups={trends.data} />
      )}
    </>
  );
}
