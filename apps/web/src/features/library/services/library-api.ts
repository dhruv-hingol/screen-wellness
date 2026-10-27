import type {
  ApiResponse,
  Page,
  Article,
  ArticleInput,
  ArticleCategory,
  ArticleTag,
  CategoryInput,
  TagInput,
  BookmarkEntry,
  ArticleMedia,
  ContentSummary,
} from '@screenwise/shared';
import { api } from '@/services/api';
import { unwrap } from '@/features/assessments/services/assessment-api';
async function paged<T>(
  request: Promise<{ data: ApiResponse<T[]> }>,
): Promise<Page<T>> {
  const { data } = await request;
  if (!data.success) throw new Error(data.error.message);
  return { data: data.data, meta: data.meta! };
}
export const libraryApi = {
  articles: (params: Record<string, unknown> = {}, admin = false) =>
    paged<Article>(
      api.get(admin ? '/admin/articles' : '/articles', { params }),
    ),
  article: (key: string, admin = false) =>
    unwrap<Article>(api.get((admin ? '/admin/articles/' : '/articles/') + key)),
  related: (slug: string) =>
    unwrap<Article[]>(api.get('/articles/' + slug + '/related')),
  categories: (admin = false) =>
    unwrap<ArticleCategory[]>(
      api.get(admin ? '/admin/categories' : '/articles/categories'),
    ),
  tags: () => unwrap<ArticleTag[]>(api.get('/articles/tags')),
  bookmarks: (page: number) =>
    paged<BookmarkEntry>(api.get('/bookmarks', { params: { page } })),
  bookmark: (articleId: string, save: boolean) =>
    unwrap(
      save
        ? api.post('/bookmarks', { articleId })
        : api.delete('/bookmarks/' + articleId),
    ),
  saveArticle: (body: ArticleInput, id?: string) =>
    unwrap<Article>(
      id
        ? api.patch('/admin/articles/' + id, body)
        : api.post('/admin/articles', body),
    ),
  transition: (article: Article, action: 'publish' | 'unpublish' | 'archive') =>
    unwrap<Article>(
      api.post('/admin/articles/' + article.id + '/' + action, {
        revision: article.revision,
      }),
    ),
  saveCategory: (body: CategoryInput, id?: string) =>
    unwrap<ArticleCategory>(
      id
        ? api.patch('/admin/categories/' + id, body)
        : api.post('/admin/categories', body),
    ),
  deactivateCategory: (id: string) =>
    unwrap<ArticleCategory>(api.delete('/admin/categories/' + id)),
  saveTag: (body: TagInput, id?: string) =>
    unwrap<ArticleTag>(
      id ? api.patch('/admin/tags/' + id, body) : api.post('/admin/tags', body),
    ),
  deleteTag: (id: string) => unwrap(api.delete('/admin/tags/' + id)),
  media: (page = 1) =>
    paged<ArticleMedia>(api.get('/admin/media', { params: { page } })),
  upload: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return unwrap<ArticleMedia>(api.post('/admin/media/upload', body));
  },
  deleteMedia: (id: string) => unwrap(api.delete('/admin/media/' + id)),
  summary: () => unwrap<ContentSummary>(api.get('/admin/content/summary')),
};
