import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assessmentSeedDefinitions,
  sqlSeedRows,
} from '../scripts/lib/assessment-seed.mjs';
import { activityInputSchema } from '../packages/shared/dist/index.js';
test('REST seeding preserves complete SQL questionnaire and activity definitions', async () => {
  const assessments = assessmentSeedDefinitions(
    await readFile(
      new URL('../supabase/seed-phase3.sql', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(assessments.length, 4);
  for (const assessment of assessments) {
    assert.equal(assessment.definition.questions.length, 8);
    assert.equal(assessment.rules.length, 2);
    for (const question of assessment.definition.questions) {
      assert.equal(question.options.length, 5);
      assert.deepEqual(
        question.options.map((option) => option.score).sort(),
        [0, 1, 2, 3, 4],
      );
    }
  }
  const activities = sqlSeedRows(
    await readFile(
      new URL('../supabase/seed-phase4.sql', import.meta.url),
      'utf8',
    ),
    ['wellness_activities'],
  ).wellness_activities;
  assert.equal(activities.length, 16);
  assert.equal(new Set(activities.map((activity) => activity.slug)).size, 16);
  for (const { id, ...activity } of activities) {
    assert.ok(id);
    assert.equal(
      activityInputSchema.safeParse({ ...activity, image_url: null }).success,
      true,
    );
  }
  assert.throws(
    () =>
      sqlSeedRows('insert into public.example(id) values(gen_random_uuid());', [
        'example',
      ]),
    /format changed/,
  );
});
