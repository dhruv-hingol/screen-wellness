// Uses the versioned SQL seed as the single source of content. This optional
// REST path is for an installed schema when a SQL connection is unavailable.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { articleInputSchema } from '../packages/shared/dist/index.js';
import {
  sanitizeArticleDocument,
  articleReadingTime,
} from '../apps/api/dist/modules/library/content.service.js';
const require = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
if (!process.argv.includes('--run'))
  throw new Error(
    'Pass --run to insert the published educational seed definitions. Existing content is preserved.',
  );
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !process.env.SUPABASE_URL)
  throw new Error('Configure apps/api/.env first.');
const db = createClient(process.env.SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const checked = (result, label) => {
  if (result.error)
    throw new Error(label + ' failed (' + result.error.code + ')');
  return result.data;
};
const sql = await readFile(
  new URL('../supabase/seed-phase5.sql', import.meta.url),
  'utf8',
);
function definitions(table, fields) {
  const start = sql.indexOf('insert into public.' + table + '('),
    end = sql.indexOf('on conflict do nothing;', start);
  const section = sql.slice(start, end).split(' values')[1];
  if (!section)
    throw new Error('Seed metadata format changed. Run the SQL seed instead.');
  return [...section.matchAll(/\(([^)]*)\)/g)].map((row) => {
    const values = [...row[1].matchAll(/'((?:[^']|'')*)'|(\d+)/g)].map((m) =>
      m[1] === undefined ? Number(m[2]) : m[1].replace(/''/g, "'"),
    );
    if (values.length !== fields.length)
      throw new Error(
        'Seed metadata columns changed. Run the SQL seed instead.',
      );
    return Object.fromEntries(
      fields.map((field, index) => [field, values[index]]),
    );
  });
}
const categoryData = definitions('article_categories', [
  'id',
  'name',
  'slug',
  'description',
  'icon',
  'display_order',
]);
const tagData = definitions('article_tags', ['id', 'name', 'slug']);
const match = sql.match(/\$articles\$([\s\S]*?)\$articles\$::jsonb/);
if (!match) throw new Error('Article seed format changed.');
const items = JSON.parse(match[1]);
const created = { articles: [], categories: [], tags: [] };
try {
  for (const [table, input, keyName] of [
    ['article_categories', categoryData, 'categories'],
    ['article_tags', tagData, 'tags'],
  ]) {
    const existing = checked(
      await db.from(table).select('id,slug,name'),
      'Read existing ' + table,
    );
    const missing = input.filter(
      (row) =>
        !existing.some(
          (value) =>
            value.id === row.id ||
            value.slug === row.slug ||
            (table === 'article_tags' && value.name === row.name),
        ),
    );
    if (missing.length)
      created[keyName] = checked(
        await db.from(table).insert(missing).select('id'),
        'Insert ' + table,
      ).map((r) => r.id);
  }
  const categories = checked(
    await db.from('article_categories').select('id,slug,is_active'),
    'Read categories',
  );
  const tags = checked(
    await db.from('article_tags').select('id,slug'),
    'Read tags',
  );
  const existing = checked(
    await db.from('articles').select('id,slug'),
    'Read existing article identifiers',
  );
  const rows = [],
    links = [];
  const text = (value) => ({ type: 'text', text: value });
  const paragraph = (value) => ({ type: 'paragraph', content: [text(value)] });
  const heading = (value) => ({
    type: 'heading',
    attrs: { level: 2 },
    content: [text(value)],
  });
  for (const item of items) {
    if (existing.some((row) => row.id === item.id || row.slug === item.slug))
      continue;
    const category = categories.find(
      (c) => c.slug === item.category && c.is_active,
    );
    if (!category) continue;
    const content = sanitizeArticleDocument({
      type: 'doc',
      content: [
        heading('Understand your routine'),
        paragraph(item.intro),
        heading('Try one small change'),
        {
          type: 'bulletList',
          content: item.tips.map((tip) => ({
            type: 'listItem',
            content: [paragraph(tip)],
          })),
        },
        heading('Reflect and adapt'),
        paragraph(item.outro),
        {
          type: 'blockquote',
          content: [
            paragraph(
              'Use these ideas for general education. Stop uncomfortable activities and seek appropriate professional advice for persistent or concerning symptoms.',
            ),
          ],
        },
      ],
    });
    const tagIds = tags
      .filter((tag) => item.tags.includes(tag.slug))
      .map((t) => t.id);
    const definition = articleInputSchema.parse({
      title: item.title,
      slug: item.slug,
      summary: item.summary,
      category_id: category.id,
      content,
      tag_ids: tagIds,
      cover_image_path: null,
      sources: [
        {
          title: item.source_title,
          source_url: item.source,
          publisher: item.publisher,
        },
      ],
      editorial_reviewed: true,
      is_featured: item.featured,
    });
    const { tag_ids, ...body } = definition;
    rows.push({
      ...body,
      id: item.id,
      ...articleReadingTime(content),
      status: 'PUBLISHED',
      published_at: '2026-10-18T03:30:00Z',
    });
    links.push(...tag_ids.map((id) => ({ article_id: item.id, tag_id: id })));
  }
  if (rows.length) {
    created.articles = checked(
      await db.from('articles').insert(rows).select('id'),
      'Insert seed articles',
    ).map((row) => row.id);
    if (links.length)
      checked(
        await db.from('article_tag_links').insert(links),
        'Insert article tags',
      );
  }
  console.log(
    JSON.stringify({
      insertedCategories: created.categories.length,
      insertedTags: created.tags.length,
      insertedArticles: created.articles.length,
      existingContentPreserved: true,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Seed failed');
  process.exitCode = 1;
  for (const [table, ids] of [
    ['articles', created.articles],
    ['article_tags', created.tags],
    ['article_categories', created.categories],
  ])
    if (ids.length) {
      const result = await db.from(table).delete().in('id', ids);
      if (result.error)
        console.error(
          'Cleanup of newly inserted ' +
            table +
            ' needs review (' +
            result.error.code +
            ').',
        );
    }
}
