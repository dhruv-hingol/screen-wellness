import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import {
  profilePatchSchema,
  preferencesPatchSchema,
  onboardingSchema,
  goalsBodySchema,
  passwordSchema,
} from '../packages/shared/dist/index.js';
test('strict schemas reject privilege injection, duplicate goals and invalid ranges', () => {
  assert.equal(
    profilePatchSchema.safeParse({ full_name: 'Alice', role: 'ADMIN' }).success,
    false,
  );
  assert.equal(
    profilePatchSchema.safeParse({ email: 'other@example.test' }).success,
    false,
  );
  assert.equal(
    preferencesPatchSchema.safeParse({ user_id: 'another', theme: 'dark' })
      .success,
    false,
  );
  assert.equal(
    preferencesPatchSchema.safeParse({ daily_screen_hours: 25 }).success,
    false,
  );
  assert.equal(
    preferencesPatchSchema.safeParse({ sleep_time: '25:90' }).success,
    false,
  );
  assert.equal(
    goalsBodySchema.safeParse({ goals: ['sleep', 'sleep'] }).success,
    false,
  );
  assert.equal(passwordSchema.safeParse('weak').success, false);
  assert.equal(passwordSchema.safeParse('LongStrong123!').success, true);
  assert.equal(
    onboardingSchema.safeParse({ full_name: 'Alice' }).success,
    false,
  );
});
test('migrations enforce owners, secure provisioning, constraints and atomic resubmission', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 `);
    for (const file of [
      '202610160001_phase2_identity.sql',
      '202610160002_private_avatars.sql',
    ])
      await db.exec(
        await readFile(
          new URL('../supabase/migrations/' + file, import.meta.url),
          'utf8',
        ),
      );
    const alice = '11111111-1111-4111-8111-111111111111',
      bob = '22222222-2222-4222-8222-222222222222';
    await db.query(
      'insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3),($4,$5,$6)',
      [
        alice,
        'alice@example.test',
        JSON.stringify({ full_name: 'Alice', role: 'ADMIN' }),
        bob,
        'bob@example.test',
        JSON.stringify({ full_name: 'Bob' }),
      ],
    );
    assert.equal(
      (await db.query('select role from profiles where id=$1', [alice])).rows[0]
        .role,
      'USER',
    );
    assert.equal(
      (await db.query('select count(*)::int n from user_preferences')).rows[0]
        .n,
      2,
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    assert.equal((await db.query('select id from profiles')).rows.length, 1);
    assert.equal(
      (await db.query('select id from profiles where id=$1', [bob])).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query('select user_id from user_preferences')).rows[0].user_id,
      alice,
    );
    await assert.rejects(
      db.query("update profiles set role='ADMIN' where id=$1", [alice]),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select public.complete_onboarding($1,$2)', [alice, '{}']),
      /permission denied/,
    );
    await db.exec('reset role;set role anon;');
    assert.equal(
      (await db.query('select current_user')).rows[0].current_user,
      'anon',
    );
    await assert.rejects(
      db.query('select * from profiles'),
      /permission denied/,
    );
    await db.exec('reset role;set role service_role;');
    const answers = {
      full_name: 'Alice Updated',
      occupation: 'Student',
      age_range: '18-24',
      primary_device: 'Laptop',
      daily_screen_hours: 5,
      usage_purpose: 'Study',
      break_frequency: 'Every hour',
      sleep_time: '23:00',
      wake_time: '07:00',
      goals: ['sleep', 'posture'],
    };
    await db.query('select public.complete_onboarding($1,$2)', [
      alice,
      JSON.stringify(answers),
    ]);
    await db.query('select public.complete_onboarding($1,$2)', [
      alice,
      JSON.stringify(answers),
    ]);
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from user_wellness_goals where user_id=$1',
          [alice],
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await db.query(
          'select onboarding_completed from profiles where id=$1',
          [alice],
        )
      ).rows[0].onboarding_completed,
      true,
    );
    await assert.rejects(
      db.query('select public.complete_onboarding($1,$2)', [
        alice,
        JSON.stringify({
          ...answers,
          full_name: 'Should roll back',
          daily_screen_hours: 25,
        }),
      ]),
    );
    assert.equal(
      (await db.query('select full_name from profiles where id=$1', [alice]))
        .rows[0].full_name,
      'Alice Updated',
    );
    await assert.rejects(
      db.query('select public.complete_onboarding($1,$2)', [
        bob,
        JSON.stringify({ ...answers, goals: ['invalid'] }),
      ]),
    );
    assert.equal(
      (
        await db.query(
          'select onboarding_completed from profiles where id=$1',
          [bob],
        )
      ).rows[0].onboarding_completed,
      false,
    );
    await db.exec('reset role;');
    await db.query(
      "insert into storage.objects(bucket_id,name) values ('avatars',$1),('avatars',$2)",
      [alice + '/one.webp', bob + '/two.webp'],
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    assert.equal(
      (await db.query('select name from storage.objects')).rows.length,
      1,
    );
    await db.exec('reset role;');
    await db.query(
      "update auth.users set email='new@example.test' where id=$1",
      [alice],
    );
    assert.equal(
      (await db.query('select email from profiles where id=$1', [alice]))
        .rows[0].email,
      'new@example.test',
    );
    await db.query('delete from auth.users where id=$1', [alice]);
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from user_wellness_goals where user_id=$1',
          [alice],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from user_preferences where user_id=$1',
          [alice],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
