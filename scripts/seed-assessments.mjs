// Optional REST seeding for an installed assessment schema. Uses existing
// transactional draft/save/publish services; skips all existing assessment slugs.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { assessmentSeedDefinitions } from './lib/assessment-seed.mjs';
import { AssessmentRepository } from '../apps/api/dist/modules/assessments/assessment.repository.js';
import { AssessmentService } from '../apps/api/dist/modules/assessments/assessment.service.js';
const require = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.SUPABASE_URL || !key)
  throw new Error('Configure Supabase server credentials in apps/api/.env.');
const db = createClient(process.env.SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const items = assessmentSeedDefinitions(
  await readFile(
    new URL('../supabase/seed-phase3.sql', import.meta.url),
    'utf8',
  ),
);
function checked(result, label) {
  if (result.error)
    throw new Error(
      label +
        ' failed (' +
        result.error.code +
        '). Existing content was not overwritten.',
    );
  return result.data;
}
const existing = checked(
  await db
    .from('assessment_types')
    .select('id,slug,status')
    .in(
      'slug',
      items.map((item) => item.metadata.slug),
    ),
  'Read existing assessment slugs',
);
const collisions = checked(
  await db
    .from('assessment_types')
    .select('id,slug')
    .in(
      'id',
      items.map((item) => item.id),
    ),
  'Check seed identifiers',
);
for (const item of items)
  if (
    collisions.some(
      (row) => row.id === item.id && row.slug !== item.metadata.slug,
    )
  )
    throw new Error(
      'A seed identifier is already used by other content; no content was modified.',
    );
const missing = items.filter(
  (item) => !existing.some((row) => row.slug === item.metadata.slug),
);
if (!process.argv.includes('--run')) {
  console.log(
    JSON.stringify(
      {
        mode: 'read-only',
        missing: missing.map((item) => item.metadata.title),
        existingSeedSlugs: existing.length,
        instruction:
          'Pass --run to create and publish only missing definitions. Existing drafts and published definitions are preserved.',
      },
      null,
      2,
    ),
  );
} else {
  const activities = checked(
    await db
      .from('wellness_activities')
      .select('id,slug')
      .eq('is_active', true)
      .in('slug', [
        '20-20-20-visual-break',
        'posture-reset',
        'evening-wind-down',
        'device-free-break',
      ]),
    'Read related activities',
  );
  const activitySlugs = {
    EYE_COMFORT: '20-20-20-visual-break',
    POSTURE: 'posture-reset',
    SLEEP: 'evening-wind-down',
    DIGITAL_FATIGUE: 'device-free-break',
  };
  const service = new AssessmentService(
    new AssessmentRepository('00000000-0000-0000-0000-000000000000', db),
  );
  let published = 0,
    rulesCreated = 0;
  for (const item of missing) {
    checked(
      await db
        .from('assessment_types')
        .insert({ id: item.id, ...item.metadata }),
      'Create ' + item.metadata.title,
    );
    // Failures leave an unpublished draft for review, never partially visible questions.
    await service.draft(item.id);
    await service.save(item.id, 0, item.definition);
    await service.publish(item.id, 1);
    published++;
    const rules = item.rules.map((rule) => ({
      ...rule,
      activity_id:
        activities.find(
          (activity) => activity.slug === activitySlugs[item.metadata.category],
        )?.id ?? null,
    }));
    if (rules.length) {
      checked(
        await db.from('recommendation_rules').insert(rules),
        'Create ' + item.metadata.title + ' recommendations',
      );
      rulesCreated += rules.length;
    }
    console.log(
      JSON.stringify({
        title: item.metadata.title,
        status: 'published',
        questions: item.definition.questions.length,
        recommendationRules: rules.length,
      }),
    );
  }
  console.log(
    JSON.stringify({
      published,
      rulesCreated,
      existingSeedSlugsPreserved: existing.length,
    }),
  );
}
