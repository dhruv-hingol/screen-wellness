// Read-only readiness checks. No URLs, keys, user IDs or personal rows are printed.
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.env.SUPABASE_URL;
if (!base || !key) {
  console.error('Configure server Supabase URL/key in apps/api/.env.');
  process.exitCode = 1;
} else {
  const headers = {
    apikey: key,
    Authorization: 'Bearer ' + key,
    'Content-Type': 'application/json',
  };
  const zero = '00000000-0000-0000-0000-000000000000';
  const day = new Date().toISOString().slice(0, 10);
  const checks = [
    [
      'Phase 4 integrity (005)',
      'wellness_goals?select=id,archived_at&limit=0',
      null,
    ],
    ['Phase 5 conflict patch (007)', 'rpc/library_conflict_code', null],
    [
      'Phase 6 personal aggregation (008)',
      'rpc/personal_wellness_analytics',
      { p_user_id: zero, p_start: day, p_end: day, p_timezone: 'UTC' },
    ],
    [
      'Phase 6 dashboard (008)',
      'rpc/dashboard_wellness_summary',
      { p_user_id: zero, p_timezone: 'UTC' },
    ],
    [
      'Phase 6 admin authorization (008)',
      'rpc/admin_wellness_analytics',
      { p_admin_id: zero, p_start: day, p_end: day, p_timezone: 'UTC' },
    ],
  ];
  for (const [dependency, path, body] of checks) {
    try {
      const response = await fetch(base + '/rest/v1/' + path, {
        method: body ? 'POST' : 'GET',
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = await response.json();
      const ready = path.includes('admin_wellness_analytics')
        ? result.code === '42501'
        : response.ok &&
          (path.includes('library_conflict_code') ? result === 'PT409' : true);
      console.log(
        JSON.stringify({
          dependency,
          ready,
          status: response.status,
          code: result.code ?? null,
        }),
      );
      if (!ready) process.exitCode = 1;
    } catch {
      console.log(
        JSON.stringify({
          dependency,
          ready: false,
          error: 'Connection failed',
        }),
      );
      process.exitCode = 1;
    }
  }
  if (process.exitCode)
    console.error(
      'Setup is incomplete. Open supabase/setup-phase6-pending.sql, copy the complete updated file into a NEW Supabase SQL Editor query and run it. This command only checks readiness; it does not execute the SQL.',
    );
}
