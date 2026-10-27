// Explicit live acceptance: creates disposable confirmed accounts/content, sends
// no email, and removes only resources owned by those new accounts in finally.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
if (!process.argv.includes('--run'))
  throw new Error(
    'Pass --run to create and clean up disposable live test resources.',
  );
const url = process.env.SUPABASE_URL,
  secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  publicKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !secret || !publicKey)
  throw new Error('Configure Supabase in apps/api/.env.');
const root = process.env.LIVE_API_URL || 'http://localhost:4000/api/v1';
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const users = [],
  cleanupCategories = [],
  cleanupTags = [];
const marker = 'verify' + randomBytes(5).toString('hex');
const checked = (r, label) => {
  if (r.error)
    throw new Error(
      label +
        ' failed (' +
        (r.error.code ?? r.error.status ?? 'service error') +
        ')',
    );
  return r.data;
};
const step = (message) => console.log('PASS: ' + message);
async function request(token, path, method = 'GET', body, expected = 200) {
  const multipart = body instanceof FormData;
  let response;
  try {
    response = await fetch(root + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? (multipart ? body : JSON.stringify(body)) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(
      method + ' ' + path.split('?')[0] + ' did not respond before the timeout',
    );
  }
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    method +
      ' ' +
      path.split('?')[0] +
      ' returned ' +
      response.status +
      ' (' +
      (result.error?.code ?? 'success') +
      ')',
  );
  if (expected < 400) assert.equal(result.success, true);
  return result;
}
async function account(isAdmin = false) {
  const email = 'screenwise-' + marker + '-' + users.length + '@example.test',
    password = 'Test!A1' + randomBytes(20).toString('hex');
  const data = checked(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Disposable Phase 5 verification' },
    }),
    'Create disposable account',
  );
  users.push({ id: data.user.id, admin: isAdmin });
  if (isAdmin)
    checked(
      await admin
        .from('profiles')
        .update({ role: 'ADMIN', onboarding_completed: true })
        .eq('id', data.user.id),
      'Set fixture administrator role',
    );
  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const session = checked(
    await client.auth.signInWithPassword({ email, password }),
    'Sign in disposable account',
  );
  return { id: data.user.id, token: session.session.access_token, client };
}
let failed = false;
try {
  checked(
    await admin.from('articles').select('id,revision').limit(0),
    'Phase 5 schema prerequisite',
  );
  const editor = await account(true),
    alice = await account(),
    bob = await account();
  step(
    'Supabase sign-in and trusted database admin role for three disposable accounts',
  );
  const categoryBody = {
    name: 'Disposable verification ' + marker,
    slug: marker,
    description: 'Temporary integration verification; removed after the run.',
    icon: null,
    display_order: 9999,
    is_active: true,
  };
  cleanupCategories.push(marker);
  const category = (
    await request(editor.token, '/admin/categories', 'POST', categoryBody, 201)
  ).data;
  cleanupTags.push(marker);
  const tag = (
    await request(
      editor.token,
      '/admin/tags',
      'POST',
      { name: marker, slug: marker },
      201,
    )
  ).data;
  const png = await sharp({
    create: { width: 12, height: 10, channels: 3, background: '#6366f1' },
  })
    .png()
    .toBuffer();
  const upload = new FormData();
  upload.append(
    'file',
    new Blob([png], { type: 'image/png' }),
    'verification.png',
  );
  const media = (
    await request(editor.token, '/admin/media/upload', 'POST', upload, 201)
  ).data;
  const imageResponse = await fetch(media.url, {
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(imageResponse.status, 200);
  assert.equal(
    (await sharp(Buffer.from(await imageResponse.arrayBuffer())).metadata())
      .format,
    'webp',
  );
  const bad = new FormData();
  bad.append(
    'file',
    new Blob(['<svg onload="alert(1)"/>'], { type: 'image/png' }),
    'fake.png',
  );
  await request(editor.token, '/admin/media/upload', 'POST', bad, 400);
  await request(alice.token, '/admin/articles', undefined, undefined, 403);
  step(
    'Real Storage upload/public download, WebP normalization, malformed-image rejection, and non-admin denial',
  );
  const content = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [
          { type: 'text', text: 'Disposable integration verification' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'This is temporary test content for verifying persistence and access control. It is removed after this run.',
          },
        ],
      },
    ],
  };
  const body = {
    title: 'Disposable article ' + marker,
    slug: marker,
    summary:
      'Temporary content used to verify real persistence and access control.',
    category_id: category.id,
    content,
    cover_image_path: null,
    tag_ids: [tag.id],
    sources: [],
    is_featured: false,
    editorial_reviewed: false,
  };
  let article = (
    await request(editor.token, '/admin/articles', 'POST', body, 201)
  ).data;
  await request(alice.token, '/articles/' + marker, undefined, undefined, 404);
  await request(
    editor.token,
    '/admin/articles/' + article.id + '/publish',
    'POST',
    { revision: article.revision },
    400,
  );
  assert.equal(
    checked(
      await alice.client.from('articles').select('id').eq('id', article.id),
      'Draft RLS',
    ).length,
    0,
  );
  const reviewed = {
    ...body,
    cover_image_path: media.path,
    sources: [
      {
        title: 'Workstation overview',
        source_url: 'https://www.osha.gov/computer-workstations',
        publisher: 'OSHA',
      },
    ],
    editorial_reviewed: true,
    revision: article.revision,
  };
  article = (
    await request(
      editor.token,
      '/admin/articles/' + article.id,
      'PATCH',
      reviewed,
    )
  ).data;
  await request(
    editor.token,
    '/admin/articles/' + article.id,
    'PATCH',
    reviewed,
    409,
  );
  await request(
    editor.token,
    '/admin/media/' + media.id,
    'DELETE',
    undefined,
    409,
  );
  article = (
    await request(
      editor.token,
      '/admin/articles/' + article.id + '/publish',
      'POST',
      { revision: article.revision },
    )
  ).data;
  assert.ok(article.reading_time_minutes >= 1);
  assert.ok(article.word_count > 0);
  assert.equal(article.status, 'PUBLISHED');
  step(
    'Draft persistence/isolation, publication validation, optimistic conflicts, server reading time, and referenced-media protection',
  );
  for (const query of [
    'search=' + marker,
    'categoryId=' + category.id,
    'tagId=' + tag.id,
    'sort=oldest&pageSize=1',
  ]) {
    const result = await request(alice.token, '/articles?' + query);
    assert.ok(Array.isArray(result.data));
    if (!query.startsWith('sort'))
      assert.ok(result.data.some((a) => a.id === article.id));
  }
  assert.equal(
    (await request(alice.token, '/articles/' + marker)).data.id,
    article.id,
  );
  const relatedBody = {
    ...reviewed,
    title: 'Related disposable article ' + marker,
    slug: marker + '-related',
  };
  delete relatedBody.revision;
  let related = (
    await request(editor.token, '/admin/articles', 'POST', relatedBody, 201)
  ).data;
  related = (
    await request(
      editor.token,
      '/admin/articles/' + related.id + '/publish',
      'POST',
      { revision: related.revision },
    )
  ).data;
  assert.ok(
    (await request(alice.token, '/articles/' + marker + '/related')).data.some(
      (a) => a.id === related.id,
    ),
  );
  step(
    'Live full-text search, category/tag filters, pagination, published details, and related articles',
  );
  await request(
    alice.token,
    '/bookmarks',
    'POST',
    { articleId: article.id },
    201,
  );
  await request(
    alice.token,
    '/bookmarks',
    'POST',
    { articleId: article.id },
    201,
  );
  const own = checked(
    await alice.client
      .from('bookmarks')
      .select('id')
      .eq('article_id', article.id),
    'Own bookmarks',
  );
  assert.equal(own.length, 1);
  assert.equal(
    checked(
      await bob.client.from('bookmarks').select('id').eq('user_id', alice.id),
      'Cross-user bookmark RLS',
    ).length,
    0,
  );
  assert.equal((await request(bob.token, '/bookmarks')).data.length, 0);
  step('Idempotent bookmark writes and two-user live PostgreSQL RLS isolation');
  article = (
    await request(
      editor.token,
      '/admin/articles/' + article.id + '/unpublish',
      'POST',
      { revision: article.revision },
    )
  ).data;
  assert.equal(
    (await request(alice.token, '/bookmarks')).data.find(
      (b) => b.article_id === article.id,
    ).article,
    null,
  );
  await request(alice.token, '/bookmarks/' + article.id, 'DELETE');
  article = (
    await request(
      editor.token,
      '/admin/articles/' + article.id + '/archive',
      'POST',
      { revision: article.revision },
    )
  ).data;
  article = (
    await request(
      editor.token,
      '/admin/articles/' + article.id + '/unpublish',
      'POST',
      { revision: article.revision },
    )
  ).data;
  assert.equal(article.status, 'DRAFT');
  await request(
    editor.token,
    '/admin/tags/' + tag.id,
    'DELETE',
    undefined,
    409,
  );
  await request(editor.token, '/admin/categories/' + category.id, 'DELETE');
  await request(
    alice.token,
    '/articles/' + related.slug,
    undefined,
    undefined,
    404,
  );
  await request(
    editor.token,
    '/admin/categories/' + category.id,
    'PATCH',
    categoryBody,
  );
  step(
    'Unpublish/archive/restore, unavailable saved articles, category deactivation, and used-tag protection',
  );
  await request(editor.token, '/admin/content/summary');
  await request(editor.token, '/admin/recommendations');
  await request(alice.token, '/assessments');
  await request(alice.token, '/activities');
  await request(alice.token, '/activities/today');
  await request(alice.token, '/recommendations/me');
  step(
    'Real content summary plus existing assessment, activity/checklist, and recommendation APIs',
  );
} catch (error) {
  failed = true;
  console.error(
    'LIVE CHECK FAILED: ' +
      (error instanceof Error ? error.message : 'Unknown error'),
  );
} finally {
  let cleanupFailed = false;
  const editor = users.find((u) => u.admin);
  if (editor) {
    try {
      checked(
        await admin.from('articles').delete().eq('author_id', editor.id),
        'Clean fixture articles',
      );
      const media = checked(
        await admin
          .from('article_media')
          .select('id,path')
          .eq('uploaded_by', editor.id),
        'Find fixture media',
      );
      if (media.length) {
        checked(
          await admin.storage
            .from('article-media')
            .remove(media.map((m) => m.path)),
          'Clean fixture Storage',
        );
        checked(
          await admin
            .from('article_media')
            .delete()
            .eq('uploaded_by', editor.id),
          'Clean fixture media metadata',
        );
      }
      for (const slug of cleanupTags)
        checked(
          await admin.from('article_tags').delete().eq('slug', slug),
          'Clean fixture tags',
        );
      for (const slug of cleanupCategories)
        checked(
          await admin.from('article_categories').delete().eq('slug', slug),
          'Clean fixture categories',
        );
    } catch (error) {
      failed = true;
      cleanupFailed = true;
      console.error('CLEANUP FAILED: ' + error.message);
    }
  }
  for (const user of users.reverse())
    try {
      checked(
        await admin.auth.admin.deleteUser(user.id),
        'Delete disposable account',
      );
    } catch (error) {
      failed = true;
      cleanupFailed = true;
      console.error('ACCOUNT CLEANUP FAILED: ' + error.message);
    }
  if (!cleanupFailed)
    console.log(
      'PASS: Disposable articles, media, taxonomy, bookmarks, and accounts removed',
    );
}
if (failed) process.exitCode = 1;
