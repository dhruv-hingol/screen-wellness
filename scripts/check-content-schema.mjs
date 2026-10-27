// Read-only diagnostics: never prints keys, URLs, row values, or personal data.
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.env.SUPABASE_URL;
if (!base || !key) {
  console.error(
    'Configure apps/api/.env with Supabase URL and server key before checking schema.',
  );
  process.exitCode = 1;
} else {
  const headers = { apikey: key, Authorization: 'Bearer ' + key };
  let pending = false;
  for (const [table, columns, migration] of [
    ['profiles', 'id', 'Phase 2 identity'],
    ['assessment_types', 'id', 'Phase 3 assessments'],
    ['recommendation_rules', 'id,activity_id', 'Phase 4 wellness'],
    ['wellness_activities', 'id', 'Phase 4 wellness'],
    ['wellness_goals', 'id,archived_at', 'Phase 4 integrity (005)'],
    ['article_categories', 'id', 'Phase 5 library (006)'],
    ['articles', 'id,revision', 'Phase 5 library (006)'],
    ['bookmarks', 'id', 'Phase 5 library (006)'],
    ['article_media', 'id', 'Phase 5 library (006)'],
  ]) {
    try {
      const response = await fetch(
        base + '/rest/v1/' + table + '?select=' + columns + '&limit=0',
        { headers },
      );
      const body = await response.json();
      console.log(
        JSON.stringify({
          table,
          columns,
          status: response.status,
          code: body.code ?? null,
          dependency: migration,
        }),
      );
      if (!response.ok) pending = true;
    } catch {
      pending = true;
      console.error('Schema check request failed for ' + table);
    }
  }
  try {
    const response = await fetch(base + '/rest/v1/rpc/library_conflict_code', {
      headers,
    });
    const body = await response.json();
    console.log(
      JSON.stringify({
        dependency: 'Phase 5 conflicts (007)',
        status: response.status,
        installed: response.ok && body === 'PT409',
      }),
    );
    if (!response.ok || body !== 'PT409') pending = true;
  } catch {
    pending = true;
    console.error('Conflict migration check failed.');
  }
  try {
    const response = await fetch(base + '/storage/v1/bucket/article-media', {
      headers,
    });
    const body = await response.json();
    console.log(
      JSON.stringify({
        bucket: 'article-media',
        status: response.status,
        code: body.statusCode ?? null,
        public: response.ok ? body.public : null,
        maxBytes: response.ok ? body.file_size_limit : null,
      }),
    );
    if (!response.ok) pending = true;
  } catch {
    pending = true;
    console.error('Storage bucket check failed.');
  }
  if (pending) {
    console.log(
      'Dependencies are incomplete. Review migration history and docs/phase5-library.md; do not rerun historical migrations blindly.',
    );
    process.exitCode = 1;
  }
}
