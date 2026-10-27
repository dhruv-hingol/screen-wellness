import { Link } from 'react-router';
import {
  Bookmark,
  BookmarkCheck,
  BookOpen,
  ArrowUpRight,
  Clock3,
} from 'lucide-react';
import type { Article } from '@screenwise/shared';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLibraryMutation } from '../hooks/use-library';
import { libraryApi } from '../services/library-api';
import { errorMessage } from '@/lib/errors';
export function BookmarkButton({
  article,
  onChange,
}: {
  article: Article;
  onChange?: () => void;
}) {
  const change = useLibraryMutation(() =>
    libraryApi.bookmark(article.id, !article.is_bookmarked),
  );
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={
        (article.is_bookmarked ? 'Remove bookmark: ' : 'Bookmark: ') +
        article.title
      }
      aria-pressed={article.is_bookmarked}
      disabled={change.isPending}
      onClick={async () => {
        try {
          await change.mutateAsync();
          onChange?.();
          toast.success(
            article.is_bookmarked ? 'Bookmark removed' : 'Article saved',
          );
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      {article.is_bookmarked ? (
        <BookmarkCheck className="text-primary" />
      ) : (
        <Bookmark />
      )}
    </Button>
  );
}
export function ArticleCover({
  article,
  className = '',
}: {
  article: Article;
  className?: string;
}) {
  return article.cover_image_url ? (
    <img
      src={article.cover_image_url}
      alt=""
      loading="lazy"
      className={'aspect-[16/9] w-full object-cover ' + className}
    />
  ) : (
    <div
      aria-hidden="true"
      className={
        'flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-secondary via-primary/10 to-accent ' +
        className
      }
    >
      <BookOpen className="size-16 text-primary/65" strokeWidth={1} />
    </div>
  );
}
export function ArticleCard({
  article: a,
  onBookmarkChange,
}: {
  article: Article;
  onBookmarkChange?: () => void;
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden py-0">
      <Link to={'/library/' + a.slug} tabIndex={-1} aria-hidden="true">
        <ArticleCover article={a} />
      </Link>
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary">{a.category.name}</Badge>
          <BookmarkButton article={a} onChange={onBookmarkChange} />
        </div>
        <h2 className="text-xl font-semibold leading-snug">
          <Link className="hover:text-primary" to={'/library/' + a.slug}>
            {a.title}
          </Link>
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {a.summary}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3.5" />
            {a.reading_time_minutes} min read
          </span>
          {a.published_at && (
            <time dateTime={a.published_at}>
              {new Date(a.published_at).toLocaleDateString()}
            </time>
          )}
        </div>
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
          to={'/library/' + a.slug}
        >
          Read article <ArrowUpRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
