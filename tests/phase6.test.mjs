import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { analyticsQuerySchema } from '../packages/shared/dist/index.js';
import {
  reportingPeriod,
  AnalyticsService,
} from '../apps/api/dist/modules/analytics/analytics.service.js';
import {
  goalProgress,
  goalProgressFromCounts,
} from '../apps/api/dist/modules/wellness/progress.service.js';

test('reporting filters include local today, reject invalid/future ranges and cap periods', () => {
  const now = new Date('2026-03-09T02:00:00Z');
  assert.deepEqual(
    reportingPeriod(
      analyticsQuerySchema.parse({ range: '7d' }),
      'America/New_York',
      now,
    ),
    {
      startDate: '2026-03-02',
      endDate: '2026-03-08',
      timezone: 'America/New_York',
    },
  );
  for (const q of [
    { startDate: '2026-03-01' },
    { startDate: '2026-03-09', endDate: '2026-03-08' },
    { startDate: '2024-01-01', endDate: '2026-01-01' },
    { startDate: '2026-02-30', endDate: '2026-03-01' },
    { range: '7d', startDate: '2026-03-01', endDate: '2026-03-02' },
    { page: 0 },
    { pageSize: 101 },
  ])
    assert.equal(analyticsQuerySchema.safeParse(q).success, false);
  assert.throws(
    () =>
      reportingPeriod(
        analyticsQuerySchema.parse({
          startDate: '2026-03-08',
          endDate: '2026-03-09',
        }),
        'America/New_York',
        now,
      ),
    /future/,
  );
});

test('Phase 6 SQL aggregates owner data across DST, retains snapshots, paginates and suppresses private admin groups', async () => {
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
    const migrationDir = new URL('../supabase/migrations/', import.meta.url);
    const repairSql = await readFile(
      new URL('../supabase/setup-phase6-pending.sql', import.meta.url),
      'utf8',
    );
    for (const file of (await readdir(migrationDir))
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (file === '202610180005_phase4_integrity.sql') {
        // Reproduce the hosted partial installation: index exists, archive column does not.
        await db.exec(
          'create index activities_category_duration on public.wellness_activities(category,duration_seconds) where is_active;',
        );
        const integritySql = await readFile(
          new URL(file, migrationDir),
          'utf8',
        );
        await db.exec(integritySql);
        await db.exec(integritySql);
      } else await db.exec(await readFile(new URL(file, migrationDir), 'utf8'));
    }
    // A repeated complete repair must tolerate already-installed 005 and 008.
    await db.exec(repairSql);
    await db.exec(repairSql);
    for (const phase of [3, 4])
      await db.exec(
        await readFile(
          new URL('../supabase/seed-phase' + phase + '.sql', import.meta.url),
          'utf8',
        ),
      );
    const owner = randomUUID(),
      other = randomUUID(),
      admin = randomUUID();
    for (const id of [owner, other, admin])
      await db.query(
        'insert into auth.users(id,email,raw_user_meta_data) values($1,$2,\'{"full_name":"Analytics Tester"}\')',
        [id, id + '@example.test'],
      );
    await db.query("update public.profiles set role='ADMIN' where id=$1", [
      admin,
    ]);
    const activity = (
      await db.query(
        'select id,to_jsonb(a) snapshot from public.wellness_activities a order by id limit 1',
      )
    ).rows[0];
    const times = [
      '2026-03-08T04:59:59Z',
      '2026-03-08T05:00:00Z',
      '2026-03-09T03:59:59Z',
      '2026-03-09T04:00:00Z',
    ];
    for (const at of times)
      await db.query(
        "insert into activity_sessions(user_id,activity_id,started_at,completed_at,duration_seconds,status,source,idempotency_key,activity_snapshot) values($1,$2,$3::timestamptz-interval '1 minute',$3,60,'COMPLETED','MANUAL',$4,$5)",
        [owner, activity.id, at, randomUUID(), activity.snapshot],
      );
    await db.query(
      "insert into activity_sessions(user_id,activity_id,completed_at,duration_seconds,status,source,idempotency_key,activity_snapshot) values($1,$2,'2026-03-08T12:00Z',60,'COMPLETED','MANUAL',$3,$4)",
      [other, activity.id, randomUUID(), activity.snapshot],
    );
    await db.query(
      'update wellness_activities set is_active=false where id=$1',
      [activity.id],
    );
    const gId = randomUUID();
    await db.query(
      "insert into wellness_goals(id,user_id,title,category,target_count,period,start_date,tracking_start,timezone,created_at) values($1,$2,'Daily wellness','GENERAL',2,'DAILY','2026-03-08','2026-03-08','America/New_York','2026-03-08T05:00Z')",
      [gId, owner],
    );
    await db.query(
      'insert into goal_activity_links(goal_id,activity_id) values($1,$2)',
      [gId, activity.id],
    );
    const rpc = async (user = owner, page = 1) =>
      (
        await db.query(
          "select public.personal_wellness_analytics($1,'2026-03-08','2026-03-08','America/New_York',null,$2,1) data",
          [user, page],
        )
      ).rows[0].data;
    const result = await rpc();
    assert.equal(result.overview.activities, 2);
    assert.equal(result.daily.length, 1);
    assert.equal(result.daily[0].count, 2);
    assert.equal(result.timeline.total, 2);
    assert.equal(result.timeline.rows.length, 1);
    assert.notEqual(
      result.timeline.rows[0].id,
      (await rpc(owner, 2)).timeline.rows[0].id,
    );
    assert.equal(result.distribution[0].count, 2);
    assert.equal((await rpc(other)).overview.activities, 1);
    assert.equal((await rpc(admin)).overview.activities, 0);
    const g = result.goalDefinitions[0];
    const sessions = (
      await db.query('select * from activity_sessions where user_id=$1', [
        owner,
      ])
    ).rows;
    const asOf = new Date(result.goalAsOf[g.id]);
    assert.equal(asOf.toISOString(), '2026-03-09T03:59:59.999Z');
    assert.deepEqual(
      goalProgressFromCounts(g, result.goalCounts[g.id], asOf),
      goalProgress(g, sessions, asOf),
    );
    assert.equal(
      goalProgressFromCounts(g, result.goalCounts[g.id], asOf).count,
      2,
    );
    const service = new AnalyticsService({
      timezone: async () => 'America/New_York',
      personal: async () => result,
    });
    const dto = await service.personal(
      analyticsQuerySchema.parse({
        startDate: '2026-03-08',
        endDate: '2026-03-08',
      }),
    );
    assert.equal(dto.goals.achieved, 1);
    assert.equal(dto.streak.current, 1);
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query(
        "select public.personal_wellness_analytics($1,'2026-03-08','2026-03-08','UTC',null,1,20)",
        [other],
      ),
      /permission denied/,
    );
    await db.exec('reset role');
    await assert.rejects(
      db.query(
        "select public.admin_wellness_analytics($1,'2026-03-08','2026-03-08','UTC')",
        [owner],
      ),
      /Administrator/,
    );
    let aggregate = (
      await db.query(
        "select public.admin_wellness_analytics($1,'2026-03-08','2026-03-08','America/New_York') data",
        [admin],
      )
    ).rows[0].data;
    assert.equal(aggregate.overview.activities.suppressed, true);
    assert.equal(aggregate.overview.activities.value, null);
    assert.equal(aggregate.activities[0].value, null);
    assert.equal(JSON.stringify(aggregate).includes(owner), false);
    assert.equal(JSON.stringify(aggregate).includes('Analytics Tester'), false);
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      await db.query('insert into auth.users(id,email) values($1,$2)', [
        id,
        id + '@example.test',
      ]);
      await db.query(
        "insert into activity_sessions(user_id,activity_id,completed_at,duration_seconds,status,source,idempotency_key,activity_snapshot) values($1,$2,'2026-03-08T12:00Z',60,'COMPLETED','MANUAL',$3,$4)",
        [id, activity.id, randomUUID(), activity.snapshot],
      );
    }
    aggregate = (
      await db.query(
        "select public.admin_wellness_analytics($1,'2026-03-08','2026-03-08','America/New_York') data",
        [admin],
      )
    ).rows[0].data;
    assert.equal(aggregate.overview.activeUsers.value, 5);
    assert.equal(aggregate.overview.activities.value, 6);
    assert.equal(
      aggregate.activities.find(
        (row) => row.label === activity.snapshot.category,
      ).value,
      6,
    );
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query(
        "select public.admin_wellness_analytics($1,'2026-03-08','2026-03-08','UTC')",
        [admin],
      ),
      /permission denied/,
    );
    await db.exec('reset role');
    const version = (
      await db.query(
        "select v.id,v.assessment_id,t.title,t.category from assessment_versions v join assessment_types t on t.id=v.assessment_id where v.status='published' order by v.id limit 1",
      )
    ).rows[0];
    for (const key of ['compatible-a', 'compatible-a', 'different-b'])
      await db.query(
        "insert into assessment_attempts(user_id,assessment_id,assessment_version_id,total_score,normalized_score,minimum_score,maximum_score,feedback_category,explanation,compatibility_key,assessment_title,category,version_number,result_snapshot,idempotency_key,request_hash,submitted_at) values($1,$2,$3,50,50,0,100,'Moderate reported concern','Educational explanation',$4,$5,$6,1,'{}',$7,'test-only','2026-03-08T12:00Z')",
        [
          owner,
          version.assessment_id,
          version.id,
          key,
          version.title,
          version.category,
          randomUUID(),
        ],
      );
    const withAttempts = await rpc();
    assert.equal(withAttempts.overview.assessments, 3);
    assert.equal(withAttempts.assessments.length, 2);
    assert.deepEqual(
      withAttempts.assessments.map((s) => s.points.length).sort(),
      [1, 2],
    );
    assert.equal(withAttempts.assessmentHistory.total, 3);
    assert.equal(withAttempts.assessmentHistory.rows.length, 1);
    assert.equal(
      'result_snapshot' in withAttempts.assessmentHistory.rows[0],
      false,
    );
    const filtered = (
      await db.query(
        "select personal_wellness_analytics($1,'2026-03-08','2026-03-08','America/New_York','INVALID_CATEGORY',1,20) data",
        [owner],
      )
    ).rows[0].data;
    assert.equal(filtered.assessments.length, 0);
    assert.equal(filtered.overview.assessments, 3);
    assert.equal(filtered.overview.activities, 2);
    const summary = (
      await db.query(
        "select dashboard_wellness_summary($1,'America/New_York') data",
        [owner],
      )
    ).rows[0].data;
    assert.ok(summary.latestAssessment);
    assert.equal(summary.latestAssessment.assessmentId, version.assessment_id);
    assert.equal(summary.todayActivities.target, null);
    assert.equal(summary.todayActivities.plannedCompleted, 0);
    await db.query("update wellness_goals set status='ARCHIVED' where id=$1", [
      gId,
    ]);
    const archivedBefore = (
      await db.query('select * from wellness_goals where id=$1', [gId])
    ).rows[0];
    await db.exec(
      await readFile(
        new URL('202610180005_phase4_integrity.sql', migrationDir),
        'utf8',
      ),
    );
    await db.exec(repairSql);
    assert.deepEqual(
      (await db.query('select * from wellness_goals where id=$1', [gId]))
        .rows[0],
      archivedBefore,
    );
  } finally {
    await db.close();
  }
});
