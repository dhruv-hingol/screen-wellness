import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  articleInputSchema,
  type ArticleInput,
  type Article,
  type ArticleCategory,
  type ArticleTag,
} from '@screenwise/shared';
import { libraryApi } from '@/features/library/services/library-api';
import {
  useLibraryQuery,
  useLibraryMutation,
} from '@/features/library/hooks/use-library';
import { PageHeader } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
} from '@/features/assessments/components/assessment-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '../components/rich-text-editor';
import { MediaPicker } from '../components/media-picker';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
export function ArticleEditorPage() {
  const { id } = useParams();
  const query = useLibraryQuery(
    ['admin-article', id],
    () => libraryApi.article(id!, true),
    !!id,
  );
  const categories = useLibraryQuery(['admin-categories'], () =>
    libraryApi.categories(true),
  );
  const tags = useLibraryQuery(['tags'], libraryApi.tags);
  if ((id && query.isPending) || categories.isPending || tags.isPending)
    return <AssessmentLoading />;
  const error = query.error ?? categories.error ?? tags.error;
  if (error)
    return (
      <QueryError
        error={error}
        retry={() => {
          void query.refetch();
          void categories.refetch();
          void tags.refetch();
        }}
      />
    );
  return (
    <ArticleForm
      key={id ?? 'new'}
      article={query.data}
      categories={categories.data ?? []}
      tags={tags.data ?? []}
    />
  );
}
function ArticleForm({
  article,
  categories,
  tags,
}: {
  article?: Article;
  categories: ArticleCategory[];
  tags: ArticleTag[];
}) {
  const navigate = useNavigate(),
    [media, setMedia] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const defaults: ArticleInput = article
    ? {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        category_id: article.category_id,
        content: article.content,
        cover_image_path: article.cover_image_path,
        tag_ids: article.tag_ids,
        sources: article.sources,
        is_featured: article.is_featured,
        editorial_reviewed: article.editorial_reviewed,
        revision: article.revision,
      }
    : {
        title: '',
        slug: '',
        summary: '',
        category_id: categories.find((c) => c.is_active)?.id ?? '',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        cover_image_path: null,
        tag_ids: [],
        sources: [],
        is_featured: false,
        editorial_reviewed: false,
      };
  const form = useForm<ArticleInput>({
    resolver: zodResolver(articleInputSchema),
    defaultValues: defaults,
  });
  const content = useWatch({ control: form.control, name: 'content' }),
    cover = useWatch({ control: form.control, name: 'cover_image_path' }),
    selected = useWatch({ control: form.control, name: 'tag_ids' });
  const sources = useFieldArray({ control: form.control, name: 'sources' });
  const save = useLibraryMutation((body: ArticleInput) =>
    libraryApi.saveArticle(body, article?.id),
  );
  const fields = form.formState.errors;
  const coverUrl = cover ? libraryMediaUrl(cover) : null;
  return (
    <>
      <PageHeader
        title={article ? 'Edit article' : 'Create an article'}
        description="Save a draft, review sources, and publish when it is ready."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/admin/articles">All articles</Link>
            </Button>
            {article && (
              <Button asChild variant="outline">
                <Link to={'/admin/articles/' + article.id + '/preview'}>
                  Preview saved version
                </Link>
              </Button>
            )}
          </div>
        }
      />
      {article?.status === 'ARCHIVED' ? (
        <p className="rounded-xl border bg-card p-6">
          This article is archived. Restore it to a draft from article
          management before editing.
        </p>
      ) : (
        <form
          noValidate
          className="space-y-6"
          onSubmit={form.handleSubmit(async (body) => {
            try {
              const saved = await save.mutateAsync(body);
              form.reset({
                ...body,
                content: saved.content,
                revision: saved.revision,
              });
              toast.success(
                saved.status === 'PUBLISHED'
                  ? 'Published article updated'
                  : 'Draft saved',
              );
              if (!article)
                navigate('/admin/articles/' + saved.id + '/edit', {
                  replace: true,
                });
            } catch (e) {
              toast.error(errorMessage(e));
            }
          })}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0 space-y-5 rounded-xl border bg-card p-5 sm:p-7">
              <label className="block space-y-2 text-sm">
                Title
                <Input
                  {...form.register('title', {
                    onChange: (event) => {
                      if (!article && !slugEdited)
                        form.setValue(
                          'slug',
                          String(event.target.value)
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-|-$/g, ''),
                        );
                    },
                  })}
                />
                <FieldError
                  message={fields.title?.message}
                  className="text-destructive"
                />
              </label>
              <label className="block space-y-2 text-sm">
                Slug
                <Input
                  {...form.register('slug', {
                    onChange: () => setSlugEdited(true),
                  })}
                />
                <FieldError
                  message={fields.slug?.message}
                  className="text-destructive"
                />
              </label>
              <label className="block space-y-2 text-sm">
                Summary
                <Textarea {...form.register('summary')} maxLength={600} />
                <FieldError
                  message={fields.summary?.message}
                  className="text-destructive"
                />
              </label>
              <div className="space-y-2">
                <p id="content-editor-label" className="text-sm font-medium">
                  Article content
                </p>
                <RichTextEditor
                  value={content}
                  onChange={(value) =>
                    form.setValue('content', value, { shouldDirty: true })
                  }
                />
                {fields.content && (
                  <p role="alert" className="text-sm text-destructive">
                    Review the article formatting. Only supported text, HTTPS
                    links, and uploaded images are accepted.
                  </p>
                )}
              </div>
              <section className="space-y-4 border-t pt-5">
                <h2 className="font-semibold">Sources and further reading</h2>
                <p className="text-xs text-muted-foreground">
                  Publishing requires at least one reviewed source. Use
                  original, trustworthy references that support factual claims.
                </p>
                {sources.fields.map((field, index) => (
                  <fieldset
                    key={field.id}
                    className="space-y-3 rounded-xl border p-4"
                  >
                    <legend className="px-2 text-sm">Source {index + 1}</legend>
                    <label className="block space-y-1 text-sm">
                      Source title
                      <Input {...form.register(`sources.${index}.title`)} />
                    </label>
                    <label className="block space-y-1 text-sm">
                      Source URL
                      <Input
                        type="url"
                        placeholder="https://"
                        {...form.register(`sources.${index}.source_url`)}
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      Publisher (optional)
                      <Input
                        {...form.register(`sources.${index}.publisher`, {
                          setValueAs: (v) => v || null,
                        })}
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => sources.remove(index)}
                    >
                      Remove source
                    </Button>
                  </fieldset>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    sources.append({
                      title: '',
                      source_url: '',
                      publisher: null,
                    })
                  }
                >
                  Add source
                </Button>
                {fields.sources && (
                  <p role="alert" className="text-sm text-destructive">
                    Enter a title and valid HTTPS URL for each source.
                  </p>
                )}
              </section>
            </div>
            <aside className="space-y-5 self-start rounded-xl border bg-card p-5">
              <label className="block space-y-2 text-sm">
                Category
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  {...form.register('category_id')}
                >
                  <option value="">Choose a category</option>
                  {categories
                    .filter((c) => c.is_active || c.id === article?.category_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {!c.is_active ? ' (inactive)' : ''}
                      </option>
                    ))}
                </select>
                <FieldError
                  message={fields.category_id?.message}
                  className="text-destructive"
                />
              </label>
              <fieldset className="space-y-3">
                <legend className="mb-2 text-sm font-medium">Tags</legend>
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(tag.id)}
                      onChange={(e) =>
                        form.setValue(
                          'tag_ids',
                          e.target.checked
                            ? [...selected, tag.id]
                            : selected.filter((id) => id !== tag.id),
                          { shouldDirty: true },
                        )
                      }
                    />
                    {tag.name}
                  </label>
                ))}
                {!tags.length && (
                  <p className="text-xs text-muted-foreground">
                    Create tags in category management.
                  </p>
                )}
              </fieldset>
              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Cover image</p>
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt="Selected cover"
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setMedia(true)}
                >
                  {cover ? 'Replace cover' : 'Choose cover image'}
                </Button>
                {cover && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      form.setValue('cover_image_path', null, {
                        shouldDirty: true,
                      })
                    }
                  >
                    Remove cover
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  Images are public by URL. Removing a saved cover cleans up the
                  object only when no article uses it.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...form.register('is_featured')} />
                Feature this article
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  {...form.register('editorial_reviewed')}
                />
                <span>
                  I reviewed the content and references for accuracy and
                  appropriate educational language.
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Reading time is calculated from saved content. Drafts remain
                private; publish from article management after reviewing the
                saved preview.
              </p>
              <Button
                type="submit"
                className="w-full"
                disabled={save.isPending}
              >
                {save.isPending
                  ? 'Saving…'
                  : article?.status === 'PUBLISHED'
                    ? 'Save published changes'
                    : 'Save draft'}
              </Button>
              <FormErrors errors={fields} />
            </aside>
          </div>
        </form>
      )}
      {media && (
        <MediaPicker
          onClose={() => setMedia(false)}
          onSelect={(m) => {
            form.setValue('cover_image_path', m.path, { shouldDirty: true });
            setMedia(false);
          }}
        />
      )}
    </>
  );
}
function libraryMediaUrl(path: string) {
  return (
    String(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '') +
    '/storage/v1/object/public/article-media/' +
    path
  );
}
