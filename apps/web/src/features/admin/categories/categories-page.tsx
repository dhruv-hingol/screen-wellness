import { FieldError, FormErrors } from '@/components/common/form-errors';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  categoryInputSchema,
  tagInputSchema,
  type ArticleCategory,
  type ArticleTag,
  type CategoryInput,
  type TagInput,
} from '@screenwise/shared';
import { toast } from 'sonner';
import { libraryApi } from '@/features/library/services/library-api';
import {
  useLibraryQuery,
  useLibraryMutation,
} from '@/features/library/hooks/use-library';
import { PageHeader, EmptyState } from '@/components/common/page-elements';
import {
  AssessmentLoading,
  QueryError,
} from '@/features/assessments/components/assessment-elements';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { errorMessage } from '@/lib/errors';
export function AdminCategoriesPage() {
  const categories = useLibraryQuery(['admin-categories'], () =>
      libraryApi.categories(true),
    ),
    tags = useLibraryQuery(['tags'], libraryApi.tags);
  const [editing, setEditing] = useState<ArticleCategory | null | undefined>(
      undefined,
    ),
    [editingTag, setEditingTag] = useState<ArticleTag | null | undefined>(
      undefined,
    );
  const deactivate = useLibraryMutation(libraryApi.deactivateCategory),
    removeTag = useLibraryMutation(libraryApi.deleteTag);
  return (
    <>
      <PageHeader
        title="Categories and tags"
        description="Organize the library while preserving links and article history."
        action={
          <Button onClick={() => setEditing(null)}>Create category</Button>
        }
      />
      {categories.isPending ? (
        <AssessmentLoading />
      ) : categories.isError ? (
        <QueryError
          error={categories.error}
          retry={() => void categories.refetch()}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {categories.data.map((c) => (
            <div key={c.id} className="space-y-3 rounded-xl border bg-card p-5">
              <p className="text-xs text-muted-foreground">
                Order {c.display_order} · {c.is_active ? 'Active' : 'Inactive'}
              </p>
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <p className="text-sm text-muted-foreground">{c.description}</p>
              <p className="text-xs text-muted-foreground">/{c.slug}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(c)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  disabled={!c.is_active || deactivate.isPending}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        'Deactivate this category? Its articles stay saved but disappear from the reader library until the category is active again.',
                      )
                    )
                      return;
                    try {
                      await deactivate.mutateAsync(c.id);
                      toast.success('Category deactivated');
                    } catch (e) {
                      toast.error(errorMessage(e));
                    }
                  }}
                >
                  Deactivate
                </Button>
              </div>
            </div>
          ))}
          {!categories.data.length && (
            <EmptyState
              title="No categories yet"
              description="Create the first category before writing an article."
            />
          )}
        </div>
      )}
      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">Article tags</h2>
          <Button variant="outline" onClick={() => setEditingTag(null)}>
            Create tag
          </Button>
        </div>
        {tags.isError ? (
          <QueryError error={tags.error} retry={() => void tags.refetch()} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tags.data?.map((tag) => (
              <div
                key={tag.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4"
              >
                <span className="text-sm font-medium">{tag.name}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingTag(tag)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={removeTag.isPending}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          'Delete this unused tag? Tags linked to articles cannot be deleted.',
                        )
                      )
                        return;
                      try {
                        await removeTag.mutateAsync(tag.id);
                        toast.success('Tag removed');
                      } catch (e) {
                        toast.error(errorMessage(e));
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <Dialog
        open={editing !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit category' : 'Create category'}
            </DialogTitle>
            <DialogDescription>
              Deactivation preserves content. Articles in inactive categories
              are hidden from the reader library.
            </DialogDescription>
          </DialogHeader>
          {editing !== undefined && (
            <CategoryForm
              key={editing?.id ?? 'new'}
              category={editing ?? undefined}
              done={() => setEditing(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={editingTag !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditingTag(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? 'Edit tag' : 'Create tag'}</DialogTitle>
            <DialogDescription>
              Give readers another way to find related articles.
            </DialogDescription>
          </DialogHeader>
          {editingTag !== undefined && (
            <TagForm
              key={editingTag?.id ?? 'new'}
              tag={editingTag ?? undefined}
              done={() => setEditingTag(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
function CategoryForm({
  category,
  done,
}: {
  category?: ArticleCategory;
  done: () => void;
}) {
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: category
      ? {
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          display_order: category.display_order,
          is_active: category.is_active,
        }
      : {
          name: '',
          slug: '',
          description: null,
          icon: null,
          display_order: 0,
          is_active: true,
        },
  });
  const save = useLibraryMutation((body: CategoryInput) =>
    libraryApi.saveCategory(body, category?.id),
  );
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (body) => {
        try {
          await save.mutateAsync(body);
          toast.success('Category saved');
          done();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      })}
    >
      {(['name', 'slug', 'icon'] as const).map((name) => (
        <label key={name} className="block space-y-2 text-sm">
          {name === 'icon'
            ? 'Icon label (optional)'
            : name === 'name'
              ? 'Category name'
              : 'Category slug'}
          <Input
            {...form.register(name, {
              setValueAs: (v) => (name === 'icon' ? v || null : v),
            })}
          />
          <FieldError
            message={form.formState.errors[name]?.message}
            className="text-destructive"
          />
        </label>
      ))}
      <label className="block space-y-2 text-sm">
        Description
        <Textarea
          {...form.register('description', { setValueAs: (v) => v || null })}
        />
      </label>
      <label className="block space-y-2 text-sm">
        Display order
        <Input
          type="number"
          min={0}
          max={9999}
          {...form.register('display_order', { valueAsNumber: true })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register('is_active')} />
        Active category
      </label>
      <FormErrors errors={form.formState.errors} />
      <Button disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save category'}
      </Button>
    </form>
  );
}
function TagForm({ tag, done }: { tag?: ArticleTag; done: () => void }) {
  const form = useForm<TagInput>({
    resolver: zodResolver(tagInputSchema),
    defaultValues: { name: tag?.name ?? '', slug: tag?.slug ?? '' },
  });
  const save = useLibraryMutation((body: TagInput) =>
    libraryApi.saveTag(body, tag?.id),
  );
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit(async (body) => {
        try {
          await save.mutateAsync(body);
          toast.success('Tag saved');
          done();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      })}
    >
      {(['name', 'slug'] as const).map((name) => (
        <label key={name} className="block space-y-2 text-sm">
          {name === 'name' ? 'Tag name' : 'Tag slug'}
          <Input {...form.register(name)} />
          <FieldError
            message={form.formState.errors[name]?.message}
            className="text-destructive"
          />
        </label>
      ))}
      <Button disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save tag'}
      </Button>
    </form>
  );
}
