import { Link, useParams } from 'react-router';
import { libraryApi } from '../services/library-api';
import { useLibraryQuery } from '../hooks/use-library';
import { ArticleContent } from '../components/article-content';
import {
  ArticleCard,
  ArticleCover,
  BookmarkButton,
} from '../components/article-card';
import {
  AssessmentLoading,
  QueryError,
} from '@/features/assessments/components/assessment-elements';
import { Badge } from '@/components/ui/badge';
import type { Article } from '@screenwise/shared';
export function ArticleReadingView({
  article: a,
  preview = false,
}: {
  article: Article;
  preview?: boolean;
}) {
  return (
    <article className="mx-auto max-w-3xl">
      {preview && (
        <p role="status" className="mb-5 rounded-xl bg-secondary p-4 text-sm">
          Editorial preview · {a.status.toLowerCase()} · visible only to
          administrators
        </p>
      )}
      <Badge variant="secondary">{a.category.name}</Badge>
      <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
        {a.title}
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
        {a.summary}
      </p>
      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          <p>{a.author_name}</p>
          <p className="mt-1">
            {a.reading_time_minutes} min read
            {a.published_at &&
              ' · ' + new Date(a.published_at).toLocaleDateString()}
          </p>
        </div>
        {!preview && <BookmarkButton article={a} />}
      </div>
      {a.cover_image_url && (
        <ArticleCover article={a} className="mb-8 rounded-xl" />
      )}
      <ArticleContent content={a.content} />
      <div className="mt-8 flex flex-wrap gap-2">
        {a.tags.map((t) => (
          <Link
            key={t.id}
            className="rounded-full border px-3 py-1 text-xs text-primary hover:bg-muted"
            to={'/library?tagId=' + t.id}
          >
            {t.name}
          </Link>
        ))}
      </div>
      {a.sources.length > 0 && (
        <section className="mt-9 rounded-xl border bg-muted/30 p-5">
          <h2 className="font-semibold">Sources and further reading</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {a.sources.map((s, i) => (
              <li key={i}>
                <a
                  href={
                    s.source_url.startsWith('https://')
                      ? s.source_url
                      : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {s.title}
                </a>
                {s.publisher && (
                  <span className="text-muted-foreground">
                    {' '}
                    · {s.publisher}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
        Educational information for everyday reflection. It does not diagnose
        conditions or replace personalized professional advice.
      </p>
    </article>
  );
}
export function ArticlePage() {
  const { slug = '' } = useParams();
  const query = useLibraryQuery(['article', slug], () =>
    libraryApi.article(slug),
  );
  const related = useLibraryQuery(
    ['related', slug],
    () => libraryApi.related(slug),
    !!query.data,
  );
  return (
    <>
      <Link
        to="/library"
        className="mb-6 inline-block text-sm text-primary hover:underline"
      >
        ← Back to library
      </Link>
      {query.isPending ? (
        <AssessmentLoading />
      ) : query.isError ? (
        <QueryError error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ArticleReadingView article={query.data} />
      )}{' '}
      {!!related.data?.length && (
        <section className="mt-12">
          <h2 className="mb-5 text-2xl font-semibold">Keep exploring</h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {related.data.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
