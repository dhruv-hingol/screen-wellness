import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BookOpen, ArrowUpRight, Bookmark } from 'lucide-react';
import { libraryApi } from '../services/library-api';
import { useLibraryQuery } from '../hooks/use-library';
import { ArticleCard, ArticleCover } from '../components/article-card';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
  Pagination,
} from '@/features/assessments/components/assessment-elements';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const [debounced, setDebounced] = useState(search);
  const categoryId = params.get('categoryId') ?? '',
    tagId = params.get('tagId') ?? '',
    sort = params.get('sort') ?? 'newest',
    page = Math.max(1, Number(params.get('page')) || 1);
  const update = (key: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: key === 'search' },
    );
  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(id);
  }, [search]);
  const categories = useLibraryQuery(['categories'], () =>
    libraryApi.categories(),
  );
  const tags = useLibraryQuery(['tags'], libraryApi.tags);
  const query = useLibraryQuery(
    ['articles', debounced, categoryId, tagId, sort, page],
    () =>
      libraryApi.articles({
        search: debounced || undefined,
        categoryId: categoryId || undefined,
        tagId: tagId || undefined,
        sort,
        page,
      }),
  );
  const featured = useLibraryQuery(['featured'], () =>
    libraryApi.articles({ featured: 'true', pageSize: 3 }),
  );
  const hero = featured.data?.data[0];
  return (
    <>
      <PageHeader
        title="Health Library"
        description="A little knowledge. A more balanced digital day."
        action={
          <Button variant="outline" asChild>
            <Link to="/library/bookmarks">
              <Bookmark />
              Saved articles
            </Link>
          </Button>
        }
      />
      <section className="mb-8 overflow-hidden rounded-2xl border bg-card md:grid md:grid-cols-2">
        <div className="flex flex-col justify-center p-6 sm:p-9">
          <span className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
            <BookOpen className="size-4" />
            Learn at your own pace
          </span>
          <h2 className="text-3xl font-semibold leading-tight">
            Practical ideas for life around your screens.
          </h2>
          <p className="my-4 text-sm leading-relaxed text-muted-foreground">
            Explore thoughtful guides on eye comfort, movement, sleep routines,
            and everyday digital habits.
          </p>
          <Input
            aria-label="Search articles"
            placeholder="Search titles and summaries…"
            value={search}
            onChange={(e) => update('search', e.target.value)}
          />
        </div>
        {hero ? (
          <Link
            to={'/library/' + hero.slug}
            className="relative flex min-h-64 flex-col justify-end overflow-hidden bg-secondary"
          >
            <ArticleCover article={hero} className="absolute inset-0 h-full" />
            <div className="relative mt-28 bg-card/95 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Featured · {hero.reading_time_minutes} min read
              </p>
              <h3 className="mt-2 text-xl font-semibold">{hero.title}</h3>
              <span className="mt-3 inline-flex items-center gap-2 text-sm text-primary">
                Explore this guide <ArrowUpRight className="size-4" />
              </span>
            </div>
          </Link>
        ) : (
          <div className="flex min-h-64 items-center justify-center bg-gradient-to-br from-secondary to-accent">
            <BookOpen className="size-24 text-primary/50" strokeWidth={1} />
          </div>
        )}
      </section>
      {categories.isError ? (
        <QueryError
          error={categories.error}
          retry={() => void categories.refetch()}
        />
      ) : (
        <nav
          aria-label="Article categories"
          className="mb-6 flex flex-wrap gap-2"
        >
          <Button
            variant={!categoryId ? 'default' : 'outline'}
            aria-pressed={!categoryId}
            onClick={() => update('categoryId', '')}
          >
            All articles
          </Button>
          {categories.data?.map((c) => (
            <Button
              key={c.id}
              variant={categoryId === c.id ? 'default' : 'outline'}
              aria-pressed={categoryId === c.id}
              onClick={() => update('categoryId', c.id)}
            >
              {c.name}
            </Button>
          ))}
        </nav>
      )}
      {!categoryId &&
        !tagId &&
        !search &&
        featured.data &&
        featured.data.data.length > 1 && (
          <section className="mb-9">
            <h2 className="mb-4 text-xl font-semibold">Featured reading</h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {featured.data.data.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
            </div>
          </section>
        )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">
          {search ? 'Search results' : 'All articles'}
        </h2>
        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Filter by tag"
            className="h-10 rounded-md border bg-card px-3 text-sm"
            value={tagId}
            onChange={(e) => update('tagId', e.target.value)}
          >
            <option value="">All tags</option>
            {tags.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Article sort order"
            className="h-10 rounded-md border bg-card px-3 text-sm"
            value={sort}
            onChange={(e) => update('sort', e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {query.data.data.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
          <Pagination
            page={page}
            pages={query.data.meta.totalPages}
            onChange={(p) => update('page', String(p))}
          />
        </>
      ) : (
        <EmptyState
          title="No articles found"
          description="Try another search or category. Published articles appear here when available."
        />
      )}
    </>
  );
}
