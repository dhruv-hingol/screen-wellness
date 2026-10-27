import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import {
  goalProgress,
  dueReminder,
  localDate,
} from '../apps/api/dist/modules/wellness/progress.service.js';
import {
  advanceClock,
  restoreClock,
} from '../apps/web/src/features/prevention/stores/timer-clock.ts';
import {
  goalInputSchema,
  reminderInputSchema,
  sessionPatchSchema,
} from '../packages/shared/dist/index.js';
import { AssessmentService } from '../apps/api/dist/modules/assessments/assessment.service.js';
const goal = (extra = {}) => ({
  id: randomUUID(),
  user_id: randomUUID(),
  title: 'Move daily',
  description: null,
  category: 'MOVEMENT',
  target_count: 2,
  period: 'DAILY',
  start_date: '2026-03-07',
  end_date: null,
  tracking_start: '2026-03-07',
  timezone: 'America/New_York',
  status: 'ACTIVE',
  activity_ids: ['walk'],
  pause_ranges: [],
  definition_history: [],
  ...extra,
});
const session = (date, id = 'walk') => ({
  activity_id: id,
  status: 'COMPLETED',
  completed_at: date,
});
test('daily/weekly goal progress handles timezone boundaries, missed days, pauses and DST', () => {
  const g = goal();
  const sessions = [
    session('2026-03-07T15:00Z'),
    session('2026-03-07T16:00Z'),
    session('2026-03-08T13:00Z'),
    session('2026-03-08T14:00Z'),
    session('2026-03-09T01:00Z'),
  ];
  assert.equal(
    localDate('2026-03-09T01:00Z', 'America/New_York'),
    '2026-03-08',
  );
  const p = goalProgress(g, sessions, new Date('2026-03-09T15:00Z'));
  assert.equal(p.count, 0);
  assert.equal(p.currentStreak, 2);
  assert.equal(p.longestStreak, 2);
  const missed = goalProgress(g, sessions, new Date('2026-03-10T15:00Z'));
  assert.equal(missed.currentStreak, 0);
  const paused = goalProgress(
    goal({ pause_ranges: [{ from: '2026-03-08', to: '2026-03-08' }] }),
    sessions,
    new Date('2026-03-09T15:00Z'),
  );
  assert.equal(paused.currentStreak, 0);
  const weekly = goalProgress(
    goal({
      period: 'WEEKLY',
      start_date: '2026-03-02',
      tracking_start: '2026-03-02',
      target_count: 3,
    }),
    sessions,
    new Date('2026-03-09T15:00Z'),
  );
  assert.equal(weekly.streakUnit, 'weeks');
  assert.equal(weekly.currentStreak, 1);
  assert.equal(weekly.periodStart, '2026-03-09');
  const wrong = sessions.map((s) => ({ ...s, activity_id: 'other' }));
  assert.equal(goalProgress(g, wrong, new Date('2026-03-08T15:00Z')).count, 0);
  assert.equal(
    goalProgress(
      goal({ end_date: '2026-03-08' }),
      sessions,
      new Date('2026-03-10T15:00Z'),
    ).currentStreak,
    0,
  );
  assert.equal(goalInputSchema.safeParse({ target_count: 0 }).success, false);
});
test('reminder slots are timezone-aware, respect schedule/disabled states and repeat DST slots deduplicate', () => {
  const r = {
    id: 'reminder',
    reminder_type: 'EYE_BREAK',
    enabled: true,
    interval_minutes: 20,
    start_time: '09:00',
    end_time: '18:00',
    days_of_week: [1, 2, 3, 4, 5],
    timezone: 'Asia/Kolkata',
  };
  const a = dueReminder(r, new Date('2026-10-16T04:00Z'));
  const b = dueReminder(r, new Date('2026-10-16T04:09Z'));
  assert.ok(a);
  assert.equal(a.key, b.key);
  assert.notEqual(a.key, dueReminder(r, new Date('2026-10-16T04:10Z')).key);
  assert.equal(
    dueReminder({ ...r, enabled: false }, new Date('2026-10-16T04:00Z')),
    null,
  );
  assert.equal(dueReminder(r, new Date('2026-10-17T04:00Z')), null);
  assert.equal(dueReminder(r, new Date('2026-10-16T23:00Z')), null);
  const dst = {
    ...r,
    timezone: 'America/New_York',
    start_time: '00:00',
    end_time: '04:00',
    days_of_week: [0],
  };
  assert.equal(
    dueReminder(dst, new Date('2026-11-01T05:10Z')).key,
    dueReminder(dst, new Date('2026-11-01T06:10Z')).key,
  );
  assert.equal(
    reminderInputSchema.safeParse({ ...r, user_id: 'forged' }).success,
    false,
  );
  assert.equal(
    reminderInputSchema.safeParse({
      ...r,
      start_time: '20:00',
      end_time: '09:00',
    }).success,
    false,
  );
  assert.equal(
    sessionPatchSchema.safeParse({
      status: 'COMPLETED',
      duration_seconds: 999,
      completed_at: 'tomorrow',
    }).success,
    false,
  );
});
test('timestamp timer handles throttling and refresh conservatively and requires explicit confirmation', () => {
  const running = {
    phase: 'FOCUS',
    remaining: 20000,
    deadline: 30000,
    running: true,
  };
  assert.equal(advanceClock(running, 15000).remaining, 15000);
  const expired = advanceClock(running, 90000);
  assert.equal(expired.phase, 'FOCUS_READY');
  assert.equal(expired.running, false);
  const pause = restoreClock(advanceClock(running, 16000));
  assert.equal(pause.remaining, 14000);
  assert.equal(pause.deadline, null);
  assert.equal(pause.running, false);
  const done = advanceClock({ ...running, phase: 'BREAK' }, 90000);
  assert.equal(done.phase, 'CONFIRM');
  assert.equal(done.running, false);
});

test('archiving a goal freezes completion history at the archive timestamp', () => {
  const g = goal({
    status: 'ARCHIVED',
    archived_at: '2026-03-08T14:00:00Z',
    updated_at: '2026-03-10T15:00:00Z',
    target_count: 1,
  });
  const sessions = [
    session('2026-03-07T15:00:00Z'),
    session('2026-03-08T13:00:00Z'),
    session('2026-03-08T15:00:00Z'),
    session('2026-03-09T15:00:00Z'),
  ];
  const p = goalProgress(g, sessions, new Date('2026-03-10T15:00:00Z'));
  assert.equal(p.currentStreak, 0);
  assert.equal(p.longestStreak, 2);
  assert.equal(p.history.at(-1).date, '2026-03-08');
  assert.equal(p.history.at(-1).count, 1);
});

test('recommendation refresh accepts persisted rule metadata and Phase 4 activity links', async () => {
  const records = [];
  const rule = {
    id: randomUUID(),
    revision: 1,
    assessment_id: randomUUID(),
    activity_id: randomUUID(),
    rule_name: 'Visual pause',
    conditions: {
      mode: 'all',
      conditions: [{ field: 'score', min: 0, max: 100 }],
    },
    recommendation_title: 'Take a visual pause',
    recommendation_description:
      'Consider a comfortable break from your screen.',
    recommendation_type: 'EYE_COMFORT',
    priority: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const attempt = {
    id: randomUUID(),
    assessment_id: rule.assessment_id,
    category: 'EYE_COMFORT',
    normalized_score: 50,
    feedback_category: 'Moderate reported concern',
    submitted_at: new Date().toISOString(),
  };
  const repo = {
    attempts: async () => ({ rows: [attempt], total: 1 }),
    goals: async () => [],
    responses: async () => [],
    rules: async () => [rule],
    storeRecommendations: async (id, suggestions) =>
      records.push({ id, suggestions }),
  };
  const result = await new AssessmentService(repo).refresh();
  assert.equal(result.evaluatedAssessments, 1);
  assert.equal(records[0].suggestions[0].rule_id, rule.id);
  assert.equal(records[0].suggestions[0].rule_revision, 1);
});
test('Phase 4 SQL preserves ownership, idempotent sessions, atomic goals, historical definitions and deduped notifications', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;`);
    for (const file of [
      '202610160001_phase2_identity.sql',
      '202610160003_phase3_assessments.sql',
      '202610160004_phase4_wellness.sql',
      '202610180005_phase4_integrity.sql',
    ])
      await db.exec(
        await readFile(
          new URL('../supabase/migrations/' + file, import.meta.url),
          'utf8',
        ),
      );
    await db.exec(
      await readFile(
        new URL('../supabase/seed-phase3.sql', import.meta.url),
        'utf8',
      ),
    );
    const revisions = (
      await db.query('select id,revision from recommendation_rules order by id')
    ).rows;
    const seed = await readFile(
      new URL('../supabase/seed-phase4.sql', import.meta.url),
      'utf8',
    );
    await db.exec(seed);
    await db.exec(seed);
    assert.deepEqual(
      (
        await db.query(
          'select id,revision from recommendation_rules order by id',
        )
      ).rows,
      revisions,
    );
    const firstRule = revisions[0];
    await db.query(
      'update recommendation_rules set recommendation_title=$1 where id=$2',
      ['An edited educational suggestion', firstRule.id],
    );
    assert.equal(
      (
        await db.query(
          'select revision from recommendation_rules where id=$1',
          [firstRule.id],
        )
      ).rows[0].revision,
      firstRule.revision + 1,
    );
    assert.equal(
      (await db.query('select count(*)::int n from wellness_activities'))
        .rows[0].n,
      16,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from recommendation_rules where activity_id is not null',
        )
      ).rows[0].n,
      8,
    );
    const alice = randomUUID(),
      bob = randomUUID();
    await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)', [
      alice,
      'a@example.test',
      bob,
      'b@example.test',
    ]);
    await db.exec('set role service_role;');
    const a = (
      await db.query(
        "select * from wellness_activities where slug='20-20-20-visual-break'",
      )
    ).rows[0];
    const key = randomUUID();
    const start = async (owner, k = key, source = 'MANUAL') =>
      (
        await db.query('select public.start_activity_session($1,$2,$3,$4) id', [
          owner,
          a.id,
          k,
          source,
        ])
      ).rows[0].id;
    const id = await start(alice);
    assert.equal(await start(alice), id);
    await db.query("select public.finish_activity_session($1,$2,'COMPLETED')", [
      alice,
      id,
    ]);
    await db.query("select public.finish_activity_session($1,$2,'COMPLETED')", [
      alice,
      id,
    ]);
    assert.equal(
      (await db.query('select count(*)::int n from activity_sessions')).rows[0]
        .n,
      1,
    );
    await assert.rejects(
      db.query("select public.finish_activity_session($1,$2,'COMPLETED')", [
        bob,
        id,
      ]),
      /not found/,
    );
    await assert.rejects(
      db.query("select public.finish_activity_session($1,$2,'CANCELLED')", [
        alice,
        id,
      ]),
      /already ended/,
    );
    const daily = await start(alice, randomUUID(), 'CHECKLIST');
    assert.equal(await start(alice, randomUUID(), 'CHECKLIST'), daily);
    const timer = await start(alice, randomUUID(), 'TIMER');
    assert.equal(await start(alice, randomUUID(), 'TIMER'), timer);
    await assert.rejects(
      db.query("select public.finish_activity_session($1,$2,'COMPLETED')", [
        alice,
        timer,
      ]),
      /20-second break/,
    );
    await db.query(
      "update activity_sessions set started_at=now()-interval '21 seconds' where id=$1",
      [timer],
    );
    await db.query("select public.finish_activity_session($1,$2,'COMPLETED')", [
      alice,
      timer,
    ]);
    const savedTimer = (
      await db.query(
        'select duration_seconds,completed_at from activity_sessions where id=$1',
        [timer],
      )
    ).rows[0];
    assert.ok(savedTimer.duration_seconds >= 20 && savedTimer.completed_at);
    const expired = await start(alice, randomUUID());
    await db.query(
      "update activity_sessions set started_at=now()-interval '25 hours' where id=$1",
      [expired],
    );
    await assert.rejects(
      db.query("select public.finish_activity_session($1,$2,'COMPLETED')", [
        alice,
        expired,
      ]),
      /expired/,
    );
    await db.query("select public.finish_activity_session($1,$2,'CANCELLED')", [
      alice,
      expired,
    ]);
    const today = (
      await db.query(
        "select (now() at time zone 'Asia/Kolkata')::date::text as local_day",
      )
    ).rows[0].local_day;
    const input = {
      title: 'Visual pauses',
      description: null,
      category: 'EYE_COMFORT',
      target_count: 3,
      period: 'DAILY',
      start_date: today,
      end_date: null,
      timezone: 'Asia/Kolkata',
      activity_ids: [a.id],
    };
    const goalId = (
      await db.query('select public.save_wellness_goal($1,null,$2,null) id', [
        alice,
        JSON.stringify(input),
      ])
    ).rows[0].id;
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from goal_activity_links where goal_id=$1',
          [goalId],
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      db.query('select public.save_wellness_goal($1,$2,$3,null)', [
        bob,
        goalId,
        JSON.stringify(input),
      ]),
      /not found/,
    );
    await assert.rejects(
      db.query('select public.save_wellness_goal($1,$2,$3,null)', [
        alice,
        goalId,
        JSON.stringify({ ...input, activity_ids: [randomUUID()] }),
      ]),
      /active activities/,
    );
    assert.equal(
      (
        await db.query('select target_count from wellness_goals where id=$1', [
          goalId,
        ])
      ).rows[0].target_count,
      3,
    );
    await db.query('select public.save_wellness_goal($1,$2,$3,null)', [
      alice,
      goalId,
      JSON.stringify({ ...input, target_count: 4 }),
    ]);
    assert.equal(
      (
        await db.query(
          'select jsonb_array_length(definition_history) n from wellness_goals where id=$1',
          [goalId],
        )
      ).rows[0].n,
      1,
    );
    await db.query("select public.save_wellness_goal($1,$2,null,'PAUSED')", [
      alice,
      goalId,
    ]);
    await db.query("select public.save_wellness_goal($1,$2,null,'ACTIVE')", [
      alice,
      goalId,
    ]);
    assert.equal(
      (
        await db.query('select pause_ranges from wellness_goals where id=$1', [
          goalId,
        ])
      ).rows[0].pause_ranges[0].to,
      today,
    );
    await db.query("select public.save_wellness_goal($1,$2,null,'ARCHIVED')", [
      alice,
      goalId,
    ]);
    const archivedAt = (
      await db.query('select archived_at from wellness_goals where id=$1', [
        goalId,
      ])
    ).rows[0].archived_at;
    assert.ok(archivedAt);
    await db.query("select public.save_wellness_goal($1,$2,null,'ARCHIVED')", [
      alice,
      goalId,
    ]);
    assert.deepEqual(
      (
        await db.query('select archived_at from wellness_goals where id=$1', [
          goalId,
        ])
      ).rows[0].archived_at,
      archivedAt,
    );
    await assert.rejects(
      db.query("select public.save_wellness_goal($1,$2,null,'ACTIVE')", [
        alice,
        goalId,
      ]),
      /cannot be resumed/,
    );
    const snapshot = JSON.stringify([a]);
    await db.query('select public.ensure_daily_checklist($1,$2,$3,$4)', [
      alice,
      today,
      'Asia/Kolkata',
      snapshot,
    ]);
    const saved = (
      await db.query(
        'select public.ensure_daily_checklist($1,$2,$3,$4) activities',
        [alice, today, 'Asia/Kolkata', '[]'],
      )
    ).rows[0].activities;
    assert.equal(saved.length, 1);
    const reminderId = (
      await db.query(
        "insert into reminder_settings(user_id,reminder_type,interval_minutes,enabled,start_time,end_time,days_of_week,timezone) values($1,'EYE_BREAK',20,true,'09:00','18:00',array[1,2,3,4,5],'Asia/Kolkata') returning id",
        [alice],
      )
    ).rows[0].id;
    const candidates = JSON.stringify([
      {
        reminder_id: reminderId,
        key: 'one-slot',
        title: 'Pause',
        message: 'Consider a visual pause.',
        type: 'BREAK_REMINDER',
      },
    ]);
    assert.equal(
      (
        await db.query('select * from public.insert_active_reminders($1,$2)', [
          alice,
          candidates,
        ])
      ).rows.length,
      0,
    );
    await db.query(
      'update user_preferences set notifications_enabled=true where user_id=$1',
      [alice],
    );
    assert.equal(
      (
        await db.query('select * from public.insert_active_reminders($1,$2)', [
          alice,
          candidates,
        ])
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query('select * from public.insert_active_reminders($1,$2)', [
          alice,
          candidates,
        ])
      ).rows.length,
      0,
    );
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${bob}',false);`,
    );
    for (const table of [
      'activity_sessions',
      'wellness_goals',
      'goal_activity_links',
      'reminder_settings',
      'notifications',
      'daily_wellness_checklists',
    ])
      assert.equal((await db.query('select id from ' + table)).rows.length, 0);
    await assert.rejects(
      db.query('update wellness_activities set is_active=false where id=$1', [
        a.id,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        'update activity_sessions set duration_seconds=999 where id=$1',
        [id],
      ),
      /permission denied/,
    );
    await assert.rejects(
      db.query('update notifications set is_read=true'),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.finish_activity_session($1,$2,'COMPLETED')", [
        bob,
        id,
      ]),
      /permission denied/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    assert.equal(
      (await db.query('select id from notifications')).rows.length,
      1,
    );
    assert.equal(
      (await db.query('select id from daily_wellness_checklists')).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
