import { useState } from 'react';
import { Link } from 'react-router';
import { useAssessmentList } from '@/features/assessments/hooks/use-assessments';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
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
export function AdminAssessmentsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const query = useAssessmentList({ search, page }, true);
  return (
    <>
      <PageHeader
        title="Assessment management"
        description="Create drafts and publish immutable questionnaire versions."
        action={
          <Button asChild>
            <Link to="/admin/assessments/new">Create assessment</Link>
          </Button>
        }
      />
      <Input
        aria-label="Search assessments"
        placeholder="Search assessments"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="mb-6 max-w-sm"
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
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>{a.category}</TableCell>
                  <TableCell>{a.status}</TableCell>
                  <TableCell>
                    <Link
                      to={'/admin/assessments/' + a.id + '/edit'}
                      className="text-primary underline"
                    >
                      Edit / versions
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
          title="No assessments found"
          description="Create a draft or change your search."
        />
      )}
    </>
  );
}
