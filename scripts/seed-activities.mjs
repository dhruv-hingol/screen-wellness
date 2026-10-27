import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { activityInputSchema } from '../packages/shared/dist/index.js';
import {
  sqlSeedRows,
  assessmentSeedDefinitions,
} from './lib/assessment-seed.mjs';
const require = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
);
const { createClient } = require('@supabase/supabase-js');
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !process.env.SUPABASE_URL)
  throw new Error('Configure Supabase server credentials in apps/api/.env.');
const db = createClient(process.env.SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const seed = sqlSeedRows(
  await readFile(
    new URL('../supabase/seed-phase4.sql', import.meta.url),
    'utf8',
  ),
  ['wellness_activities'],
).wellness_activities;
const items = seed.map(({ id, ...input }) => ({
  id,
  ...activityInputSchema.parse({ ...input, image_url: null }),
}));
if (items.length !== 16)
  throw new Error('Expected the sixteen versioned educational activities.');
function checked(result, label) {
  if (result.error)
    throw new Error(label + ' failed (' + result.error.code + ').');
  return result.data;
}
const existing = checked(
  await db
    .from('wellness_activities')
    .select('id,slug')
    .in(
      'slug',
      items.map((item) => item.slug),
    ),
  'Read activity slugs',
);
const collisions = checked(
  await db
    .from('wellness_activities')
    .select('id,slug')
    .in(
      'id',
      items.map((item) => item.id),
    ),
  'Check activity identifiers',
);
for (const item of items)
  if (collisions.some((row) => row.id === item.id && row.slug !== item.slug))
    throw new Error(
      'A seed identifier belongs to other content. No activities were changed.',
    );
const missing = items.filter(
  (item) => !existing.some((row) => row.slug === item.slug),
);
if (!process.argv.includes('--run'))
  console.log(
    JSON.stringify(
      {
        mode: 'read-only',
        missing: missing.map((item) => item.title),
        existingActivitiesPreserved: existing.length,
        instruction:
          'Pass --run to insert missing activities and attach available activities to unlinked seed recommendation rules.',
      },
      null,
      2,
    ),
  );
else {
  if (missing.length)
    checked(
      await db.from('wellness_activities').insert(missing),
      'Insert missing activities',
    );
  const activities = checked(
    await db
      .from('wellness_activities')
      .select('id,slug')
      .eq('is_active', true)
      .in(
        'slug',
        items.map((item) => item.slug),
      ),
    'Read available activities',
  );
  const definitions = assessmentSeedDefinitions(
    await readFile(
      new URL('../supabase/seed-phase3.sql', import.meta.url),
      'utf8',
    ),
  );
  const slugs = {
    EYE_COMFORT: '20-20-20-visual-break',
    POSTURE: 'posture-reset',
    SLEEP: 'evening-wind-down',
    DIGITAL_FATIGUE: 'device-free-break',
  };
  let linkedRules = 0;
  for (const definition of definitions) {
    const activity = activities.find(
      (item) => item.slug === slugs[definition.metadata.category],
    );
    if (activity) {
      const rows = checked(
        await db
          .from('recommendation_rules')
          .update({ activity_id: activity.id })
          .in(
            'id',
            definition.rules.map((rule) => rule.id),
          )
          .eq('recommendation_type', definition.metadata.category)
          .is('activity_id', null)
          .select('id'),
        'Link seed recommendations',
      );
      linkedRules += rows.length;
    }
  }
  console.log(
    JSON.stringify({
      insertedActivities: missing.length,
      existingActivitiesPreserved: existing.length,
      linkedRules,
    }),
  );
}
