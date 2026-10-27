import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Article } from '@screenwise/shared';
import { toast } from 'sonner';
import { libraryApi } from '@/features/library/services/library-api';
import {
  useLibraryQuery,
  useLibraryMutation,
} from '@/features/library/hooks/use-library';
import { ArticleReadingView } from '@/features/library/pages/article-page';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { errorMessage } from '@/lib/errors';
export function AdminArticlesPage() {
  const [search, setSearch] = useState(''),
    [debounced, setDebounced] = useState(''),
    [status, setStatus] = useState(''),
    [category, setCategory] = useState(''),
    [page, setPage] = useState(1);
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);
  const query = useLibraryQuery(
    ['admin-articles', debounced, status, category, page],
    () =>
      libraryApi.articles(
        {
          search: debounced,
          status: status || undefined,
          categoryId: category || undefined,
          page,
        },
        true,
      ),
  );
  const categories = useLibraryQuery(['admin-categories'], () =>
    libraryApi.categories(true),
  );
  const change = useLibraryMutation(
    ({
      article,
      action,
    }: {
      article: Article;
      action: 'publish' | 'unpublish' | 'archive';
    }) => libraryApi.transition(article, action),
  );
  return (
    <>
      <PageHeader
        title="Article management"
        description="Create useful reading, review drafts, and manage publication."
        action={
          <Button asChild>
            <Link to="/admin/articles/new">Create article</Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Input
          className="max-w-sm"
          aria-label="Search articles"
          placeholder="Search titles and summaries"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Article status"
          className="h-10 rounded-md border bg-card px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {['DRAFT', 'PUBLISHED', 'ARCHIVED'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Article category"
          className="h-10 rounded-md border bg-card px-3 text-sm"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="min-w-44 font-medium">
                    {a.title}
                  </TableCell>
                  <TableCell>{a.category.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{a.status}</Badge>
                  </TableCell>
                  <TableCell>{a.is_featured ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{a.author_name}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(a.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-56 flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={'/admin/articles/' + a.id + '/edit'}>
                          Edit
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to={'/admin/articles/' + a.id + '/preview'}>
                          Preview
                        </Link>
                      </Button>
                      {(a.status === 'ARCHIVED'
                        ? ['unpublish']
                        : a.status === 'PUBLISHED'
                          ? ['unpublish', 'archive']
                          : ['publish', 'archive']
                      ).map((action) => (
                        <Button
                          key={action}
                          variant="ghost"
                          size="sm"
                          disabled={change.isPending}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                action === 'publish'
                                  ? 'Publish this reviewed article?'
                                  : action === 'archive'
                                    ? 'Archive this article? Saved links remain but readers will not see its contents.'
                                    : 'Move this article to drafts? Readers will no longer see it.',
                              )
                            )
                              return;
                            try {
                              await change.mutateAsync({
                                article: a,
                                action: action as
                                  'publish' | 'unpublish' | 'archive',
                              });
                              toast.success('Article status updated');
                            } catch (e) {
                              toast.error(errorMessage(e));
                            }
                          }}
                        >
                          {action === 'publish'
                            ? 'Publish'
                            : action === 'archive'
                              ? 'Archive'
                              : a.status === 'ARCHIVED'
                                ? 'Restore to draft'
                                : 'Unpublish'}
                        </Button>
                      ))}
                    </div>
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
          title="No articles match"
          description="Try other filters or create a new article draft."
        />
      )}
    </>
  );
}
export function AdminArticlePreviewPage() {
  const { id = '' } = useParams();
  const query = useLibraryQuery(['admin-article', id], () =>
    libraryApi.article(id, true),
  );
  return (
    <>
      <Link
        className="mb-6 inline-block text-sm text-primary underline"
        to={'/admin/articles/' + id + '/edit'}
      >
        ← Back to editor
      </Link>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ArticleReadingView article={query.data} preview />
      )}
    </>
  );
}
