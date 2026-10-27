import { test, expect, type Page } from '@playwright/test';
import type {
  Article,
  ArticleCategory,
  ArticleTag,
  ArticleInput,
} from '../packages/shared/dist/index.js';

// Test-only identity/HTTP fixtures exercise real components. PostgreSQL/RLS and
// actual image decoding are verified independently in phase5.test.mjs.
const now = '2026-10-18T04:00:00Z';
const categories: ArticleCategory[] = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    name: 'Eye Health',
    slug: 'eye-health',
    description: 'Comfortable screen routines',
    icon: 'Eye',
    display_order: 1,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
  {
    id: '60000000-0000-4000-8000-000000000003',
    name: 'Sleep Habits',
    slug: 'sleep-habits',
    description: 'Evening routines',
    icon: 'Moon',
    display_order: 2,
    is_active: true,
    created_at: now,
    updated_at: now,
  },
];
const tags: ArticleTag[] = [
  {
    id: '62000000-0000-4000-8000-000000000001',
    name: 'Screen breaks',
    slug: 'screen-breaks',
  },
  {
    id: '62000000-0000-4000-8000-000000000003',
    name: 'Evening routine',
    slug: 'evening-routine',
  },
];
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
  'base64',
);
async function setup(page: Page, role = 'ADMIN') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const identity = {
    user: {
      id: '50000000-0000-4000-8000-000000000001',
      email: 'fixture@example.test',
    },
    profile: {
      id: '50000000-0000-4000-8000-000000000001',
      full_name: 'Editorial tester',
      email: 'fixture@example.test',
      role,
      onboarding_completed: true,
      avatar_url: null,
    },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    recovery: false,
  };
  await page.route('**/src/features/auth/auth-provider.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `const identity=${JSON.stringify(identity)};export function AuthProvider({children}){return children;}export function useAuth(){return {...identity,signOut:async()=>{},refreshProfile:async()=>{}};}`,
    }),
  );
  const cat = structuredClone(categories),
    tagRows = structuredClone(tags),
    saved = new Set<string>(),
    requests: { path: string; method: string; body: unknown }[] = [],
    media: Record<string, unknown>[] = [];
  const articles: Article[] = [
    [
      'A more comfortable screen day',
      'comfortable-screen-day',
      cat[0]!,
      tags[0]!,
    ],
    ['A calmer evening', 'calmer-evening', cat[1]!, tags[1]!],
    ['A practical desk reset', 'practical-desk-reset', cat[0]!, tags[0]!],
  ].map(([title, slug, category, tag], i) => ({
    id: '61000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
    title: String(title),
    slug: String(slug),
    summary: 'An educational guide with practical steps for your routine.',
    category_id: (category as ArticleCategory).id,
    category: category as ArticleCategory,
    tag_ids: [(tag as ArticleTag).id],
    tags: [tag as ArticleTag],
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'A small practical step' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '<img src=x onerror="window.unsafeArticle=true"> is shown as plain text.',
            },
          ],
        },
      ],
    },
    sources: [
      {
        title: 'Background reading',
        source_url: 'https://www.osha.gov/computer-workstations',
        publisher: 'OSHA',
      },
    ],
    cover_image_path: null,
    cover_image_url: null,
    editorial_reviewed: true,
    is_featured: i === 0,
    status: 'PUBLISHED',
    revision: 1,
    author_id: null,
    author_name: 'Editorial team',
    word_count: 100,
    reading_time_minutes: 1,
    published_at: now,
    created_at: now,
    updated_at: now,
    is_bookmarked: false,
  }));
  const decorated = (a: Article) => ({
    ...a,
    is_bookmarked: saved.has(a.id),
    category: cat.find((c) => c.id === a.category_id)!,
    tags: tagRows.filter((t) => a.tag_ids.includes(t.id)),
  });
  await page.route('**/storage/v1/object/public/article-media/**', (r) =>
    r.fulfill({ contentType: 'image/png', body: png }),
  );
  await page.route('**/__fixture/image.png', (r) =>
    r.fulfill({ contentType: 'image/png', body: png }),
  );
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace('/api/v1', ''),
      method = req.method(),
      body = req.headers()['content-type']?.includes('application/json')
        ? req.postDataJSON()
        : {};
    requests.push({ path, method, body });
    const ok = (data: unknown) =>
      route.fulfill({ json: { success: true, data } });
    const list = (rows: unknown[], size = 2) => {
      const p = Number(url.searchParams.get('page') ?? 1);
      return route.fulfill({
        json: {
          success: true,
          data: rows.slice((p - 1) * size, p * size),
          meta: {
            page: p,
            pageSize: size,
            total: rows.length,
            totalPages: Math.ceil(rows.length / size),
          },
        },
      });
    };
    if (path === '/reminders/poll') return ok([]);
    if (path === '/notifications/unread-count') return ok({ count: 0 });
    if (path === '/notifications') return list([]);
    if (path === '/users/me') return ok(identity.profile);
    if (path === '/users/preferences')
      return ok({
        timezone: 'Asia/Kolkata',
        theme: 'light',
        notifications_enabled: false,
      });
    if (
      path === '/articles/categories' ||
      (path === '/admin/categories' && method === 'GET')
    )
      return ok(
        path.startsWith('/admin') ? cat : cat.filter((c) => c.is_active),
      );
    if (
      path === '/articles/tags' ||
      (path === '/admin/tags' && method === 'GET')
    )
      return ok(tagRows);
    if (path === '/admin/categories' && method === 'POST') {
      const c = {
        ...body,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      cat.push(c);
      return ok(c);
    }
    if (path.startsWith('/admin/categories/')) {
      const c = cat.find((c) => c.id === path.split('/').at(-1))!;
      Object.assign(c, method === 'DELETE' ? { is_active: false } : body);
      return ok(c);
    }
    if (path === '/admin/tags' && method === 'POST') {
      const t = { ...body, id: crypto.randomUUID() };
      tagRows.push(t);
      return ok(t);
    }
    if (path.startsWith('/admin/tags/')) {
      const i = tagRows.findIndex((t) => t.id === path.split('/').at(-1));
      if (method === 'DELETE') {
        tagRows.splice(i, 1);
        return ok({ deleted: true });
      }
      Object.assign(tagRows[i]!, body);
      return ok(tagRows[i]);
    }
    if (path === '/admin/content/summary')
      return ok({
        totalArticles: articles.length,
        publishedArticles: articles.filter((a) => a.status === 'PUBLISHED')
          .length,
        draftArticles: articles.filter((a) => a.status === 'DRAFT').length,
        categories: cat.length,
        activeActivities: 16,
        activeRules: 8,
      });
    if (path === '/admin/media/upload') {
      const m = {
        id: '64000000-0000-4000-8000-000000000001',
        path: 'articles/64000000-0000-4000-8000-000000000001.webp',
        url: 'http://localhost:5173/__fixture/image.png',
        status: 'READY',
        created_at: now,
      };
      media.push(m);
      return ok(m);
    }
    if (path === '/admin/media') return list(media);
    if (path.startsWith('/admin/media/')) return ok({ deleted: true });
    if (path === '/bookmarks' && method === 'POST') {
      saved.add(body.articleId);
      return ok({ is_bookmarked: true });
    }
    if (path.startsWith('/bookmarks/') && method === 'DELETE') {
      saved.delete(path.split('/').at(-1)!);
      return ok({ is_bookmarked: false });
    }
    if (path === '/bookmarks')
      return list(
        [...saved].map((id) => ({
          id: 'bookmark-' + id,
          article_id: id,
          created_at: now,
          article:
            articles.find((a) => a.id === id)?.status === 'PUBLISHED'
              ? decorated(articles.find((a) => a.id === id)!)
              : null,
        })),
      );
    if (path === '/admin/articles' && method === 'POST') {
      const input = body as ArticleInput;
      const a = {
        ...articles[0]!,
        ...input,
        id: crypto.randomUUID(),
        status: 'DRAFT' as const,
        revision: 1,
        published_at: null,
        cover_image_url: input.cover_image_path
          ? 'http://localhost:5173/__fixture/image.png'
          : null,
      };
      articles.push(a);
      return ok(decorated(a));
    }
    if (path.startsWith('/admin/articles/') && method === 'PATCH') {
      const a = articles.find((a) => a.id === path.split('/').at(-1))!;
      Object.assign(a, body, { revision: a.revision + 1 });
      return ok(decorated(a));
    }
    if (/^\/admin\/articles\/[^/]+\/(publish|unpublish|archive)$/.test(path)) {
      const a = articles.find((a) => a.id === path.split('/')[3])!;
      a.status = path.endsWith('/publish')
        ? 'PUBLISHED'
        : path.endsWith('/unpublish')
          ? 'DRAFT'
          : 'ARCHIVED';
      a.revision++;
      a.published_at = a.status === 'PUBLISHED' ? now : a.published_at;
      return ok(decorated(a));
    }
    if (path === '/articles' || path === '/admin/articles') {
      const admin = path.startsWith('/admin');
      let rows = articles.filter(
        (a) =>
          admin ||
          (a.status === 'PUBLISHED' &&
            cat.find((c) => c.id === a.category_id)?.is_active),
      );
      if (url.searchParams.get('status'))
        rows = rows.filter((a) => a.status === url.searchParams.get('status'));
      if (url.searchParams.get('search'))
        rows = rows.filter((a) =>
          (a.title + ' ' + a.summary)
            .toLowerCase()
            .includes(url.searchParams.get('search')!.toLowerCase()),
        );
      if (url.searchParams.get('categoryId'))
        rows = rows.filter(
          (a) => a.category_id === url.searchParams.get('categoryId'),
        );
      if (url.searchParams.get('tagId'))
        rows = rows.filter((a) =>
          a.tag_ids.includes(url.searchParams.get('tagId')!),
        );
      if (url.searchParams.get('featured'))
        rows = rows.filter((a) => a.is_featured);
      if (url.searchParams.get('sort') === 'oldest')
        rows = rows.slice().reverse();
      return list(
        rows.map(decorated),
        Number(url.searchParams.get('pageSize') ?? 2),
      );
    }
    if (path.endsWith('/related'))
      return ok(
        articles
          .filter(
            (a) => a.slug !== path.split('/')[2] && a.status === 'PUBLISHED',
          )
          .map(decorated),
      );
    if (path.startsWith('/admin/articles/'))
      return ok(
        decorated(articles.find((a) => a.id === path.split('/').at(-1))!),
      );
    if (path.startsWith('/articles/'))
      return ok(
        decorated(articles.find((a) => a.slug === path.split('/').at(-1))!),
      );
    return route.fulfill({
      status: 404,
      json: {
        success: false,
        error: {
          code: 'UI_FIXTURE_MISSING',
          message: 'Missing fixture for ' + path,
        },
      },
    });
  });
  return { errors, articles, categories: cat, tags: tagRows, saved, requests };
}

test('library search/filter/pagination, safe reading, related articles, and bookmarks work', async ({
  page,
}) => {
  const state = await setup(page, 'USER');
  await page.goto('/library');
  await expect(
    page.getByRole('heading', { name: 'Health Library', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'test-results/phase5-library-desktop.png',
    fullPage: true,
  });
  await page.getByLabel('Search articles').fill('evening');
  await expect(
    page.getByRole('heading', { name: 'A calmer evening', level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'A more comfortable screen day',
      level: 2,
    }),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Sleep Habits', exact: true }).click();
  await page.getByLabel('Filter by tag').selectOption(tags[1]!.id);
  await page.getByLabel('Article sort order').selectOption('oldest');
  await expect(page).toHaveURL(/sort=oldest/);
  await page.getByLabel('Search articles').fill('');
  await page.getByRole('button', { name: 'All articles', exact: true }).click();
  await page.getByLabel('Filter by tag').selectOption('');
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 2')).toBeVisible();
  await page.goto('/library/comfortable-screen-day');
  await expect(
    page.getByRole('heading', {
      name: 'A more comfortable screen day',
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.locator('article script')).toHaveCount(0);
  expect(await page.evaluate(() => 'unsafeArticle' in window)).toBe(false);
  await expect(page.locator('.article-prose')).toContainText(
    '<img src=x onerror=',
  );
  await expect(
    page.getByRole('heading', { name: 'Keep exploring' }),
  ).toBeVisible();
  await page
    .getByRole('button', {
      name: 'Bookmark: A more comfortable screen day',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Remove bookmark: A more comfortable screen day',
      exact: true,
    }),
  ).toBeVisible();
  await page.goto('/library/bookmarks');
  await expect(
    page.getByRole('heading', {
      name: 'A more comfortable screen day',
      level: 2,
    }),
  ).toBeVisible();
  state.articles[0]!.status = 'DRAFT';
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Article no longer available' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove saved link' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your reading list starts here' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/library');
  await expect(
    page.getByRole('heading', { name: 'Health Library', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(state.errors).toEqual([]);
});

test('admin rich-text drafts, cover upload, preview, publish/unpublish, and archive work', async ({
  page,
}) => {
  const state = await setup(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/admin/articles/new');
  await page
    .getByLabel('Title', { exact: true })
    .fill('A thoughtful new guide');
  await page.getByLabel('Slug', { exact: true }).fill('a-thoughtful-new-guide');
  await page
    .getByLabel('Summary', { exact: true })
    .fill('Practical educational ideas for a more considered digital routine.');
  await page
    .getByRole('textbox', { name: 'Article content', exact: true })
    .fill('An original educational paragraph for the new guide.');
  await page.getByRole('button', { name: 'Add source', exact: true }).click();
  await page
    .getByLabel('Source title', { exact: true })
    .fill('Workstation overview');
  await page
    .getByLabel('Source URL', { exact: true })
    .fill('https://www.osha.gov/computer-workstations');
  await page.getByLabel('I reviewed the content', { exact: false }).check();
  await page.getByRole('button', { name: 'Choose cover image' }).click();
  await page
    .getByLabel('Upload image', { exact: true })
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/articles\/[^/]+\/edit$/);
  const created = state.articles.find(
    (a) => a.slug === 'a-thoughtful-new-guide',
  )!;
  expect(created.status).toBe('DRAFT');
  expect(created.cover_image_path).toContain('.webp');
  const post = state.requests.find(
    (r) => r.path === '/admin/articles' && r.method === 'POST',
  )!;
  expect(post.body).not.toHaveProperty('reading_time_minutes');
  expect(post.body).not.toHaveProperty('status');
  await page.getByRole('link', { name: 'Preview saved version' }).click();
  await expect(
    page.getByRole('heading', { name: created.title, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText('Editorial preview', { exact: false }),
  ).toBeVisible();
  await page.goto('/admin/articles');
  await page.getByLabel('Search articles').fill('thoughtful');
  const row = page.getByRole('row').filter({ hasText: created.title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(row).toContainText('PUBLISHED');
  await row.getByRole('button', { name: 'Unpublish', exact: true }).click();
  await expect(row).toContainText('DRAFT');
  await row.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(row).toContainText('ARCHIVED');
  await row
    .getByRole('button', { name: 'Restore to draft', exact: true })
    .click();
  await expect(row).toContainText('DRAFT');
  expect(state.errors).toEqual([]);
});

test('admin taxonomy and content overview use server records; members cannot open the editor', async ({
  page,
}) => {
  const state = await setup(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/admin/categories');
  await page
    .getByRole('button', { name: 'Create category', exact: true })
    .click();
  await page.getByLabel('Category name', { exact: true }).fill('Mindful work');
  await page.getByLabel('Category slug', { exact: true }).fill('mindful-work');
  await page.getByRole('button', { name: 'Save category' }).click();
  await expect(
    page.getByRole('heading', { name: 'Mindful work' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create tag', exact: true }).click();
  await page.getByLabel('Tag name', { exact: true }).fill('Planning');
  await page.getByLabel('Tag slug', { exact: true }).fill('planning');
  await page.getByRole('button', { name: 'Save tag' }).click();
  await expect(page.getByText('Planning', { exact: true })).toBeVisible();
  expect(state.categories).toHaveLength(3);
  expect(state.tags).toHaveLength(3);
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Content workspace' }),
  ).toBeVisible();
  await expect(page.getByText('Total articles', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Manage categories and tags' }),
  ).toBeVisible();
  expect(state.errors).toEqual([]);
  await page.unroute('**/src/features/auth/auth-provider.tsx*');
  await page.route('**/src/features/auth/auth-provider.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export function AuthProvider({children}){return children;}export function useAuth(){return {isLoading:false,isAuthenticated:true,profile:{role:"USER",onboarding_completed:true},user:{id:"fixture"}};}',
    }),
  );
  await page.goto('/admin/articles/new');
  await expect(
    page.getByRole('heading', { name: 'Access denied' }),
  ).toBeVisible();
});
