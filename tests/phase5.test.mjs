import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { PGlite } from '@electric-sql/pglite';
import {
  articleInputSchema,
  richDocumentSchema,
  sourceSchema,
} from '../packages/shared/dist/index.js';
import {
  sanitizeArticleDocument,
  articlePlainText,
  articleReadingTime,
} from '../apps/api/dist/modules/library/content.service.js';
import { normalizeArticleImage } from '../apps/api/dist/modules/library/library.service.js';
const require = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
);
const sharp = require('sharp');
const doc = (text = 'An original educational article.') => ({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'A practical idea' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text }] },
  ],
});
test('rich-text validation and canonicalization reject executable content and unsafe URLs', () => {
  const safe = sanitizeArticleDocument(
    doc('<script>alert(1)</script> is plain text, never HTML.'),
  );
  assert.ok(articlePlainText(safe).includes('<script>'));
  for (const n of [
    { type: 'doc', content: [{ type: 'script', text: 'alert(1)' }] },
    {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { onclick: 'alert(1)' } }],
    },
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'click',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    },
    {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'data:image/svg+xml,<svg/>' } }],
    },
    {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: 'https://example.test/x.png', onerror: 'alert(1)' },
        },
      ],
    },
    { type: 'doc', content: [{ type: 'text', text: 'invalid block nesting' }] },
  ])
    assert.equal(richDocumentSchema.safeParse(n).success, false);
  let deep = doc();
  for (let i = 0; i < 20; i++) deep = { type: 'doc', content: [deep] };
  assert.equal(richDocumentSchema.safeParse(deep).success, false);
  const link = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Safe',
            marks: [
              {
                type: 'link',
                attrs: {
                  href: 'https://example.test',
                  target: '_self',
                  rel: 'opener',
                  class: 'arbitrary',
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const clean = sanitizeArticleDocument(link);
  assert.equal(
    clean.content[0].content[0].marks[0].attrs.rel,
    'noopener noreferrer',
  );
  assert.equal(clean.content[0].content[0].marks[0].attrs.class, undefined);
  assert.equal(
    sourceSchema.safeParse({
      title: 'Source',
      source_url: 'javascript:alert(1)',
      publisher: null,
    }).success,
    false,
  );
  assert.equal(
    articleInputSchema.safeParse({
      reading_time_minutes: 1,
      status: 'PUBLISHED',
      author_id: randomUUID(),
    }).success,
    false,
  );
});
test('reading-time counts complete words across formatting and honors configured speed', () => {
  const n = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'hel', marks: [{ type: 'bold' }] },
          { type: 'text', text: 'lo world' },
        ],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'another paragraph' }],
      },
    ],
  };
  assert.equal(articlePlainText(n), 'hello world another paragraph');
  assert.deepEqual(articleReadingTime(n), {
    word_count: 4,
    reading_time_minutes: 1,
  });
  assert.equal(
    articleReadingTime(doc(Array(401).fill('word').join(' ')))
      .reading_time_minutes,
    3,
  );
  assert.equal(
    articleReadingTime(doc(Array(401).fill('word').join(' ')), 300)
      .reading_time_minutes,
    2,
  );
  assert.throws(() => articleReadingTime(n, 0), /Invalid reading speed/);
});
test('article uploads validate bytes, MIME, size and normalize to metadata-free WebP', async () => {
  const png = await sharp({
    create: { width: 10, height: 8, channels: 3, background: '#6366f1' },
  })
    .png()
    .toBuffer();
  const file = { buffer: png, size: png.length, mimetype: 'image/png' };
  const buffer = await normalizeArticleImage(file),
    metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 10);
  assert.equal(metadata.exif, undefined);
  await assert.rejects(
    normalizeArticleImage({ ...file, mimetype: 'image/jpeg' }),
    /invalid/,
  );
  await assert.rejects(
    normalizeArticleImage({ ...file, size: 5 * 1024 * 1024 + 1 }),
    /5 MB/,
  );
  await assert.rejects(
    normalizeArticleImage({
      ...file,
      buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
    }),
    /invalid/,
  );
  await assert.rejects(normalizeArticleImage(undefined), /Choose/);
});
test('Phase 5 SQL enforces draft isolation, bookmark ownership, atomic CMS, media references, and idempotent seeds', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
    for (const file of [
      '202610160001_phase2_identity.sql',
      '202610160002_private_avatars.sql',
      '202610160003_phase3_assessments.sql',
      '202610160004_phase4_wellness.sql',
      '202610180005_phase4_integrity.sql',
      '202610180006_phase5_library.sql',
      '202610180007_phase5_conflicts.sql',
    ])
      await db.exec(
        await readFile(
          new URL('../supabase/migrations/' + file, import.meta.url),
          'utf8',
        ),
      );
    const seed = await readFile(
      new URL('../supabase/seed-phase5.sql', import.meta.url),
      'utf8',
    );
    await db.exec(seed);
    await db.exec(seed);
    assert.equal(
      (await db.query('select count(*)::int n from articles')).rows[0].n,
      12,
    );
    assert.equal(
      (await db.query('select count(*)::int n from article_categories')).rows[0]
        .n,
      6,
    );
    for (const a of (
      await db.query(
        'select content,word_count,reading_time_minutes from articles',
      )
    ).rows) {
      assert.equal(richDocumentSchema.safeParse(a.content).success, true);
      assert.deepEqual(articleReadingTime(a.content), {
        word_count: a.word_count,
        reading_time_minutes: a.reading_time_minutes,
      });
    }
    const bucket = (
      await db.query("select * from storage.buckets where id='article-media'")
    ).rows[0];
    assert.equal(bucket.public, true);
    assert.equal(bucket.file_size_limit, 5242880);
    const alice = randomUUID(),
      bob = randomUUID(),
      admin = randomUUID();
    for (const [id, email] of [
      [alice, 'a@example.test'],
      [bob, 'b@example.test'],
      [admin, 'editor@example.test'],
    ])
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        id,
        email,
      ]);
    await db.query(
      "update profiles set role='ADMIN',full_name='Test Editor' where id=$1",
      [admin],
    );
    const category = (
      await db.query('select id from article_categories order by id limit 1')
    ).rows[0].id;
    const tagged = (
      await db.query('select id from article_tags order by id limit 1')
    ).rows[0].id;
    const body = {
      title: 'A draft article',
      slug: 'a-draft-article',
      summary: 'An original educational summary.',
      category_id: category,
      content: doc(),
      ...articleReadingTime(doc()),
      cover_image_path: null,
      tag_ids: [tagged],
      sources: [],
      is_featured: false,
      editorial_reviewed: false,
      media_paths: [],
    };
    await db.exec('set role service_role');
    const save = async (id, revision, input = body) =>
      (
        await db.query('select public.save_library_article($1,$2,$3,$4) id', [
          admin,
          id,
          revision,
          JSON.stringify(input),
        ])
      ).rows[0].id;
    const article = await save(null, null);
    await assert.rejects(
      db.query('select public.save_library_article($1,null,null,$2)', [
        alice,
        JSON.stringify(body),
      ]),
      /Administrator/,
    );
    await assert.rejects(
      db.query(
        "select public.transition_library_article($1,$2,1,'PUBLISHED')",
        [admin, article],
      ),
      /Review article/,
    );
    await assert.rejects(
      save(article, 1, { ...body, tag_ids: [randomUUID()] }),
      /foreign key/,
    );
    assert.equal(
      (await db.query('select revision from articles where id=$1', [article]))
        .rows[0].revision,
      1,
    );
    const reviewed = {
      ...body,
      sources: [
        {
          title: 'Workstation overview',
          source_url: 'https://www.osha.gov/computer-workstations',
          publisher: 'OSHA',
        },
      ],
      editorial_reviewed: true,
    };
    await save(article, 1, reviewed);
    await assert.rejects(
      save(article, 1, reviewed),
      (error) => error.code === 'PT409' && /changed/.test(error.message),
    );
    await db.query(
      "select public.transition_library_article($1,$2,2,'PUBLISHED')",
      [admin, article],
    );
    const bookmark = async (user) =>
      (
        await db.query('select public.bookmark_library_article($1,$2) id', [
          user,
          article,
        ])
      ).rows[0].id;
    assert.equal(await bookmark(alice), await bookmark(alice));
    assert.equal(
      (await db.query('select count(*)::int n from bookmarks')).rows[0].n,
      1,
    );
    const draftBody = { ...body, slug: 'private-draft' };
    const draft = await save(null, null, draftBody);
    await assert.rejects(
      db.query('select public.bookmark_library_article($1,$2)', [alice, draft]),
      /not found/,
    );
    const mediaId = randomUUID(),
      path = 'articles/' + mediaId + '.webp';
    await db.query(
      'insert into article_media(id,path,uploaded_by) values($1,$2,$3)',
      [mediaId, path, admin],
    );
    const withMedia = {
      ...reviewed,
      cover_image_path: path,
      media_paths: [path],
    };
    await save(article, 3, withMedia);
    await assert.rejects(
      db.query('select public.reserve_article_media_deletion($1,$2)', [
        admin,
        mediaId,
      ]),
      /in use/,
    );
    await save(article, 4, reviewed);
    assert.equal(
      (
        await db.query(
          'select public.reserve_article_media_deletion($1,$2) path',
          [admin, mediaId],
        )
      ).rows[0].path,
      path,
    );
    await assert.rejects(
      save(article, 5, withMedia),
      /available uploaded image/,
    );
    await db.query('delete from article_media where id=$1', [mediaId]);
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${bob}',false);`,
    );
    assert.equal(
      (await db.query('select id from articles where id=$1', [draft])).rows
        .length,
      0,
    );
    assert.equal((await db.query('select id from bookmarks')).rows.length, 0);
    await assert.rejects(
      db.query('insert into bookmarks(user_id,article_id) values($1,$2)', [
        alice,
        article,
      ]),
      /row-level security/,
    );
    await assert.rejects(
      db.query('update articles set title=$1 where id=$2', ['Forged', article]),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select public.save_library_article($1,null,null,$2)', [
        admin,
        JSON.stringify(body),
      ]),
      /permission denied/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    assert.equal((await db.query('select id from bookmarks')).rows.length, 1);
    await assert.rejects(
      db.query('insert into bookmarks(user_id,article_id) values($1,$2)', [
        alice,
        article,
      ]),
      /duplicate key/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${admin}',false);`,
    );
    assert.equal(
      (await db.query('select id from articles where id=$1', [draft])).rows
        .length,
      1,
    );
    await db.exec('reset role;set role service_role');
    await db.query(
      "select public.transition_library_article($1,$2,5,'DRAFT')",
      [admin, article],
    );
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    const unavailable = (
      await db.query(
        'select b.id,a.title from bookmarks b left join articles a on a.id=b.article_id',
      )
    ).rows;
    assert.equal(unavailable.length, 1);
    assert.equal(unavailable[0].title, null);
    await db.exec('reset role');
    await db.query(
      "update articles set title='Edited by an administrator' where id='61000000-0000-4000-8000-000000000001'",
    );
    await db.exec(seed);
    assert.equal(
      (
        await db.query(
          "select title from articles where id='61000000-0000-4000-8000-000000000001'",
        )
      ).rows[0].title,
      'Edited by an administrator',
    );
    assert.ok(
      (
        await db.query(
          "select id from articles where search_document @@ websearch_to_tsquery('english','evening')",
        )
      ).rows.length >= 2,
    );
    await db.query(
      'update article_categories set is_active=false where id=$1',
      [category],
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${bob}',false);`,
    );
    assert.equal(
      (
        await db.query('select id from articles where category_id=$1', [
          category,
        ])
      ).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
