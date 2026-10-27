import { Link } from 'react-router';
import { libraryApi } from '@/features/library/services/library-api';
import { useLibraryQuery } from '@/features/library/hooks/use-library';
import { PageHeader, StatCard } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
} from '@/features/assessments/components/assessment-elements';
import { Button } from '@/components/ui/button';
export function ContentOverviewPage() {
  const query = useLibraryQuery(['content-summary'], libraryApi.summary);
  return (
    <>
      <PageHeader
        title="Content workspace"
        description="Thoughtful resources, organized in one place."
        action={
          <Button asChild>
            <Link to="/admin/articles/new">Create article</Link>
          </Button>
        }
      />
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(
            [
              [
                'Total articles',
                query.data.totalArticles,
                'All saved article definitions',
              ],
              [
                'Published articles',
                query.data.publishedArticles,
                'Articles with published status',
              ],
              [
                'Draft articles',
                query.data.draftArticles,
                'Private work waiting for review',
              ],
              [
                'Article categories',
                query.data.categories,
                'Active and inactive categories',
              ],
              [
                'Active activities',
                query.data.activeActivities,
                'Published wellness activities',
              ],
              [
                'Active rules',
                query.data.activeRules,
                'Enabled recommendation rules',
              ],
            ] as const
          ).map(([label, value, description]) => (
            <StatCard
              key={label}
              label={label}
              value={value}
              description={description}
            />
          ))}
        </div>
      )}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Keep the library useful</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          Review sources before publishing. Drafts and archived articles stay
          private; published text appears in the reader library when its
          category is active.
        </p>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ['/admin/articles', 'Manage articles'],
              ['/admin/categories', 'Manage categories and tags'],
              ['/admin/activities', 'Manage activities'],
              ['/admin/recommendations', 'Manage recommendation rules'],
              ['/admin/analytics', 'View platform analytics'],
            ] as const
          ).map(([path, label]) => (
            <Button key={path} asChild variant="outline">
              <Link to={path}>{label}</Link>
            </Button>
          ))}
        </div>
      </section>
    </>
  );
}
