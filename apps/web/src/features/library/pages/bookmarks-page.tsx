import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { libraryApi } from '../services/library-api';
import { useLibraryQuery, useLibraryMutation } from '../hooks/use-library';
import { ArticleCard } from '../components/article-card';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
export function BookmarksPage() {
  const [page, setPage] = useState(1);
  const query = useLibraryQuery(['bookmarks', page], () =>
    libraryApi.bookmarks(page),
  );
  const remove = useLibraryMutation((id: string) =>
    libraryApi.bookmark(id, false),
  );
  return (
    <>
      <PageHeader
        title="Saved for a quieter moment"
        description="Your bookmarked articles, ready when you are."
        action={
          <Button asChild variant="outline">
            <Link to="/library">Explore library</Link>
          </Button>
        }
      />
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.data.map((b) =>
              b.article ? (
                <ArticleCard
                  key={b.id}
                  article={b.article}
                  onBookmarkChange={() => {
                    if (query.data.data.length === 1 && page > 1)
                      setPage(page - 1);
                  }}
                />
              ) : (
                <div
                  key={b.id}
                  className="space-y-4 rounded-xl border bg-card p-6"
                >
                  <h2 className="font-semibold">Article no longer available</h2>
                  <p className="text-sm text-muted-foreground">
                    It may have been unpublished or archived. You can remove the
                    saved link.
                  </p>
                  <Button
                    variant="outline"
                    disabled={remove.isPending}
                    onClick={async () => {
                      try {
                        await remove.mutateAsync(b.article_id);
                        if (query.data.data.length === 1 && page > 1)
                          setPage(page - 1);
                      } catch (e) {
                        toast.error(errorMessage(e));
                      }
                    }}
                  >
                    Remove saved link
                  </Button>
                </div>
              ),
            )}
          </div>
          <Pagination
            page={page}
            pages={query.data.meta.totalPages}
            onChange={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="Your reading list starts here"
          description="Save an article from the library to find it here later."
        />
      )}
    </>
  );
}
