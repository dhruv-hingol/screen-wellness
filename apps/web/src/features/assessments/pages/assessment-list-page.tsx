import { useState } from 'react';
import { Link } from 'react-router';
import { assessmentCategories } from '@screenwise/shared';
import { useAssessmentList } from '../hooks/use-assessments';
import {
  AssessmentCard,
  AssessmentLoading,
  QueryError,
  EducationalNote,
  Pagination,
} from '../components/assessment-elements';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export function AssessmentListPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const query = useAssessmentList({
    search,
    category: category || undefined,
    page,
  });
  return (
    <>
      <PageHeader
        title="Understand your digital habits"
        description="Take a moment to reflect on your everyday wellbeing."
        action={
          <Button asChild variant="outline">
            <Link to="/assessments/history">Assessment history</Link>
          </Button>
        }
      />
      <EducationalNote />
      <div className="my-6 flex flex-wrap gap-3">
        <Input
          aria-label="Search assessments"
          placeholder="Search assessments"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <select
          aria-label="Assessment category"
          className="h-10 rounded-md border bg-background px-3"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {assessmentCategories.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {query.data.data.map((a) => (
              <AssessmentCard key={a.id} assessment={a} />
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
          title="No published assessments found"
          description="Try another filter. If the collection is empty, an administrator needs to publish assessments or apply the Phase 3 seed."
        />
      )}
    </>
  );
}
