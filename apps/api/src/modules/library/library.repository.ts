import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Article,
  ArticleCategory,
  ArticleTag,
  ArticleQuery,
  CategoryInput,
  TagInput,
  ArticleMedia,
  BookmarkEntry,
  ContentSummary,
} from '@screenwise/shared';
import { getAdminClient } from '../../config/supabase.js';
import { AppError } from '../../utils/app-error.js';

export function libraryChecked<T>(r: {
  data: T;
  error: { code?: string } | null;
}): NonNullable<T> {
  if (r.error) {
    const code = r.error.code;
    if (code === '23505')
      throw new AppError(
        409,
        'DUPLICATE_CONTENT',
        'That slug or name already exists. Choose another.',
      );
    if (code === '40001' || code === 'PT409')
      throw new AppError(
        409,
        'CONTENT_CONFLICT',
        'This content changed or the image is still in use. Reload before continuing.',
      );
    if (code === '23503')
      throw new AppError(
        409,
        'CONTENT_IN_USE',
        'The selected resource is missing or still in use.',
      );
    if (code === 'P0002' || code === 'PGRST116')
      throw new AppError(
        404,
        'NOT_FOUND',
        'Content not found or no longer available.',
      );
    if (code === '42501')
      throw new AppError(
        403,
        'FORBIDDEN',
        'Administrator permission is required.',
      );
    if (code === 'P0001' || code === '23514')
      throw new AppError(
        400,
        'INVALID_CONTENT',
        'Review the content, active category, sources, and editorial confirmation before publishing.',
      );
    throw new AppError(
      503,
      'LIBRARY_UNAVAILABLE',
      'Content is unavailable. Confirm the Phase 5 migrations and Storage setup.',
    );
  }
  if (r.data === null)
    throw new AppError(404, 'NOT_FOUND', 'Content not found.');
  return r.data!;
}
const fields =
  '*,category:article_categories(*),tag_links:article_tag_links(tag:article_tags(*))';
type ArticleRow = Article & { tag_links: { tag: ArticleTag }[] };
export class LibraryRepository {
  readonly admin = getAdminClient();
  constructor(
    readonly userId: string,
    private scoped: SupabaseClient,
  ) {}
  publicUrl(path: string) {
    return this.admin.storage.from('article-media').getPublicUrl(path).data
      .publicUrl;
  }
  private async decorate(rows: ArticleRow[]) {
    if (!rows.length) return [];
    const saved = libraryChecked(
      await this.scoped
        .from('bookmarks')
        .select('article_id')
        .eq('user_id', this.userId)
        .in(
          'article_id',
          rows.map((r) => r.id),
        ),
    ) as { article_id: string }[];
    const savedIds = new Set(saved.map((r) => r.article_id));
    return rows.map(({ tag_links, ...row }) => ({
      ...row,
      tags: tag_links.map((l) => l.tag),
      tag_ids: tag_links.map((l) => l.tag.id),
      cover_image_url: row.cover_image_path
        ? this.publicUrl(row.cover_image_path)
        : null,
      is_bookmarked: savedIds.has(row.id),
    }));
  }
  async articles(q: ArticleQuery, admin = false) {
    let query = (admin ? this.admin : this.scoped)
      .from('articles')
      .select(
        fields +
          (q.tagId ? ',filter_tags:article_tag_links!inner(tag_id)' : ''),
        { count: 'exact' },
      );
    // Published APIs enforce their own filters even for authenticated admins.
    if (!admin)
      query = query
        .eq('status', 'PUBLISHED')
        .eq('category.is_active', true)
        .not('category', 'is', null);
    else if (q.status) query = query.eq('status', q.status);
    if (q.categoryId) query = query.eq('category_id', q.categoryId);
    if (q.tagId) query = query.eq('filter_tags.tag_id', q.tagId);
    if (q.featured) query = query.eq('is_featured', q.featured === 'true');
    if (q.search)
      query = query.textSearch('search_document', q.search, {
        type: 'websearch',
        config: 'english',
      });
    const result = await query
      .order(admin ? 'updated_at' : 'published_at', {
        ascending: q.sort === 'oldest',
      })
      .order('id')
      .range((q.page - 1) * q.pageSize, q.page * q.pageSize - 1);
    const rows = libraryChecked(result) as unknown as ArticleRow[];
    return { rows: await this.decorate(rows), total: result.count ?? 0 };
  }
  async article(key: string, admin = false) {
    let query = (admin ? this.admin : this.scoped)
      .from('articles')
      .select(fields)
      .eq(admin ? 'id' : 'slug', key);
    if (!admin)
      query = query
        .eq('status', 'PUBLISHED')
        .eq('category.is_active', true)
        .not('category', 'is', null);
    const row = libraryChecked(await query.single()) as unknown as ArticleRow;
    return (await this.decorate([row]))[0]!;
  }
  async related(article: Article) {
    const selected: Article[] = [];
    const add = (rows: Article[]) => {
      for (const row of rows)
        if (
          row.id !== article.id &&
          !selected.some((a) => a.id === row.id) &&
          selected.length < 3
        )
          selected.push(row);
    };
    add(
      (
        await this.articles({
          page: 1,
          pageSize: 4,
          search: '',
          sort: 'newest',
          categoryId: article.category_id,
        })
      ).rows,
    );
    for (const tag of article.tags) {
      if (selected.length >= 3) break;
      add(
        (
          await this.articles({
            page: 1,
            pageSize: 4,
            search: '',
            sort: 'newest',
            tagId: tag.id,
          })
        ).rows,
      );
    }
    if (selected.length < 3)
      add(
        (
          await this.articles({
            page: 1,
            pageSize: 4,
            search: '',
            sort: 'newest',
          })
        ).rows,
      );
    return selected;
  }
  async categories(admin = false) {
    let query = (admin ? this.admin : this.scoped)
      .from('article_categories')
      .select('*')
      .order('display_order')
      .order('name');
    if (!admin) query = query.eq('is_active', true);
    return libraryChecked(await query) as ArticleCategory[];
  }
  async tags() {
    return libraryChecked(
      await this.scoped.from('article_tags').select('*').order('name'),
    ) as ArticleTag[];
  }
  async saveCategory(body: CategoryInput, id?: string) {
    return libraryChecked(
      await (
        id
          ? this.admin.from('article_categories').update(body).eq('id', id)
          : this.admin.from('article_categories').insert(body)
      )
        .select('*')
        .single(),
    ) as ArticleCategory;
  }
  async deactivateCategory(id: string) {
    return libraryChecked(
      await this.admin
        .from('article_categories')
        .update({ is_active: false })
        .eq('id', id)
        .select('*')
        .single(),
    );
  }
  async saveTag(body: TagInput, id?: string) {
    return libraryChecked(
      await (
        id
          ? this.admin.from('article_tags').update(body).eq('id', id)
          : this.admin.from('article_tags').insert(body)
      )
        .select('*')
        .single(),
    ) as ArticleTag;
  }
  async deleteTag(id: string) {
    libraryChecked(
      await this.admin
        .from('article_tags')
        .delete()
        .eq('id', id)
        .select('id')
        .single(),
    );
    return { id, deleted: true };
  }
  async saveArticle(
    body: Record<string, unknown>,
    id?: string,
    revision?: number,
  ) {
    const result = libraryChecked(
      await this.admin.rpc('save_library_article', {
        p_editor: this.userId,
        p_id: id ?? null,
        p_revision: revision ?? null,
        p_definition: body,
      }),
    );
    return this.article(String(result), true);
  }
  async transition(id: string, revision: number, status: Article['status']) {
    libraryChecked(
      await this.admin.rpc('transition_library_article', {
        p_editor: this.userId,
        p_id: id,
        p_revision: revision,
        p_status: status,
      }),
    );
    return this.article(id, true);
  }
  async bookmarks(q: ArticleQuery) {
    const result = await this.scoped
      .from('bookmarks')
      .select('id,article_id,created_at', { count: 'exact' })
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .order('id')
      .range((q.page - 1) * q.pageSize, q.page * q.pageSize - 1);
    const rows = libraryChecked(result) as Omit<BookmarkEntry, 'article'>[];
    const articles = rows.length
      ? await this.scoped
          .from('articles')
          .select(fields)
          .in(
            'id',
            rows.map((r) => r.article_id),
          )
          .eq('status', 'PUBLISHED')
          .eq('category.is_active', true)
          .not('category', 'is', null)
      : { data: [], error: null };
    const available = await this.decorate(
      libraryChecked(articles) as unknown as ArticleRow[],
    );
    return {
      rows: rows.map((row) => ({
        ...row,
        article: available.find((a) => a.id === row.article_id) ?? null,
      })),
      total: result.count ?? 0,
    };
  }
  async bookmark(articleId: string) {
    const id = libraryChecked(
      await this.admin.rpc('bookmark_library_article', {
        p_user: this.userId,
        p_article: articleId,
      }),
    );
    return { id, article_id: articleId, is_bookmarked: true };
  }
  async removeBookmark(articleId: string) {
    libraryChecked(
      await this.admin
        .from('bookmarks')
        .delete()
        .eq('user_id', this.userId)
        .eq('article_id', articleId)
        .select('id'),
    );
    return { article_id: articleId, is_bookmarked: false };
  }
  async media(q: ArticleQuery) {
    const r = await this.admin
      .from('article_media')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id')
      .range((q.page - 1) * q.pageSize, q.page * q.pageSize - 1);
    return {
      rows: (libraryChecked(r) as ArticleMedia[]).map((m) => ({
        ...m,
        url: this.publicUrl(m.path),
      })),
      total: r.count ?? 0,
    };
  }
  async mediaByPaths(paths: string[]) {
    return paths.length
      ? (libraryChecked(
          await this.admin
            .from('article_media')
            .select('*')
            .in('path', paths)
            .eq('status', 'READY'),
        ) as ArticleMedia[])
      : [];
  }
  async insertMedia(id: string, path: string) {
    return libraryChecked(
      await this.admin
        .from('article_media')
        .insert({ id, path, uploaded_by: this.userId })
        .select('*')
        .single(),
    ) as ArticleMedia;
  }
  async reserveMedia(id: string) {
    return String(
      libraryChecked(
        await this.admin.rpc('reserve_article_media_deletion', {
          p_editor: this.userId,
          p_id: id,
        }),
      ),
    );
  }
  async mediaDeletionState(id: string) {
    const media = libraryChecked(
      await this.admin
        .from('article_media')
        .select('id,path,status')
        .eq('id', id)
        .single(),
    ) as ArticleMedia;
    const [links, covers] = await Promise.all([
      this.admin
        .from('article_media_links')
        .select('article_id')
        .eq('media_id', id)
        .limit(1),
      this.admin
        .from('articles')
        .select('id')
        .eq('cover_image_path', media.path)
        .limit(1),
    ]);
    return {
      media,
      inUse:
        libraryChecked(links).length > 0 || libraryChecked(covers).length > 0,
    };
  }
  async restoreMedia(id: string) {
    libraryChecked(
      await this.admin
        .from('article_media')
        .update({ status: 'READY' })
        .eq('id', id)
        .select('id'),
    );
  }
  async deleteMediaRecord(id: string) {
    libraryChecked(
      await this.admin
        .from('article_media')
        .delete()
        .eq('id', id)
        .eq('status', 'DELETING')
        .select('id'),
    );
  }
  async summary(): Promise<ContentSummary> {
    const count = async (
      table: string,
      field?: string,
      value?: string | boolean,
    ) => {
      let query = this.admin
        .from(table)
        .select('id', { count: 'exact', head: true });
      if (field) query = query.eq(field, value!);
      const r = await query;
      if (r.error) libraryChecked({ data: [], error: r.error });
      return r.count ?? 0;
    };
    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      categories,
      activeActivities,
      activeRules,
    ] = await Promise.all([
      count('articles'),
      count('articles', 'status', 'PUBLISHED'),
      count('articles', 'status', 'DRAFT'),
      count('article_categories'),
      count('wellness_activities', 'is_active', true),
      count('recommendation_rules', 'is_active', true),
    ]);
    return {
      totalArticles,
      publishedArticles,
      draftArticles,
      categories,
      activeActivities,
      activeRules,
    };
  }
}
