import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import {
  scoreAssessment,
  evaluateRule,
} from '../apps/api/dist/modules/assessments/scoring.service.js';
import {
  conditionSchema,
  submissionSchema,
  ruleInputSchema,
} from '../packages/shared/dist/index.js';
const bands = [
  {
    min: 0,
    label: 'Lower reported concern',
    explanation: 'Lower educational grouping',
  },
  {
    min: 34,
    label: 'Moderate reported concern',
    explanation: 'Moderate educational grouping',
  },
  {
    min: 67,
    label: 'Higher reported concern',
    explanation: 'Higher educational grouping',
  },
];
function fixture() {
  return {
    id: randomUUID(),
    assessment_id: randomUUID(),
    version_number: 1,
    status: 'published',
    draft_revision: 0,
    scoring_config: { compatibilityKey: 'frequency-test', bands },
    questions: [
      {
        id: randomUUID(),
        question_text: 'Reported concern',
        question_type: 'single_choice',
        is_required: true,
        display_order: 1,
        options: [
          {
            id: randomUUID(),
            option_text: 'Never',
            score: 0,
            display_order: 1,
          },
          {
            id: randomUUID(),
            option_text: 'Often',
            score: 4,
            display_order: 2,
          },
        ],
      },
      {
        id: randomUUID(),
        question_text: 'Healthy habit',
        question_type: 'single_choice',
        is_required: true,
        display_order: 2,
        options: [
          {
            id: randomUUID(),
            option_text: 'Never',
            score: 4,
            display_order: 1,
          },
          {
            id: randomUUID(),
            option_text: 'Often',
            score: 0,
            display_order: 2,
          },
        ],
      },
    ],
  };
}
test('backend scoring validates membership, required answers, duplicates and reverse scoring', () => {
  const v = fixture();
  const response = v.questions.map((q) => ({
    questionId: q.id,
    selectedOptionId: q.options[0].id,
  }));
  assert.equal(scoreAssessment(v, response).normalized_score, 50);
  response[1].selectedOptionId = v.questions[1].options[1].id;
  assert.equal(scoreAssessment(v, response).normalized_score, 0);
  response[0].selectedOptionId = v.questions[0].options[1].id;
  assert.equal(
    scoreAssessment(v, response).feedback_category,
    'Moderate reported concern',
  );
  assert.throws(() => scoreAssessment(v, response.slice(0, 1)), /required/);
  assert.throws(() => scoreAssessment(v, [response[0], response[0]]), /once/);
  assert.throws(
    () =>
      scoreAssessment(v, [
        {
          questionId: v.questions[0].id,
          selectedOptionId: v.questions[1].options[0].id,
        },
        response[1],
      ]),
    /does not belong/,
  );
  assert.throws(
    () =>
      scoreAssessment(v, [
        { questionId: randomUUID(), selectedOptionId: randomUUID() },
      ]),
    /does not belong/,
  );
  const zero = fixture();
  for (const q of zero.questions) for (const o of q.options) o.score = 2;
  assert.equal(
    scoreAssessment(
      zero,
      zero.questions.map((q) => ({
        questionId: q.id,
        selectedOptionId: q.options[0].id,
      })),
    ).normalized_score,
    0,
  );
  const optional = fixture();
  optional.questions[1].is_required = false;
  const minimal = scoreAssessment(optional, [
    {
      questionId: optional.questions[0].id,
      selectedOptionId: optional.questions[0].options[0].id,
    },
  ]);
  const both = scoreAssessment(
    optional,
    optional.questions.map((q) => ({
      questionId: q.id,
      selectedOptionId: q.options[0].id,
    })),
  );
  assert.notEqual(minimal.compatibility_key, both.compatibility_key);
});
test('conditions are bounded data; all/any, answer and wellness-interest matching are deterministic', () => {
  const v = fixture();
  const context = {
    category: 'EYE_COMFORT',
    score: 60,
    feedback: 'Moderate reported concern',
    responses: [
      {
        questionId: v.questions[0].id,
        selectedOptionId: v.questions[0].options[1].id,
      },
    ],
    goals: ['eye_comfort'],
  };
  const rule = {
    id: randomUUID(),
    assessment_id: v.assessment_id,
    revision: 1,
    rule_name: 'Visual habits',
    conditions: {
      mode: 'all',
      conditions: [
        { field: 'score', min: 34, max: 100 },
        { field: 'goal', value: 'eye_comfort' },
        {
          field: 'answer',
          questionId: context.responses[0].questionId,
          optionId: context.responses[0].selectedOptionId,
        },
      ],
    },
    recommendation_title: 'Pause regularly',
    recommendation_description:
      'Consider a manageable pause between long tasks.',
    recommendation_type: 'EYE_COMFORT',
    priority: 2,
    is_active: true,
  };
  assert.ok(evaluateRule(rule, context));
  assert.equal(evaluateRule(rule, { ...context, goals: [] }), null);
  assert.ok(
    evaluateRule(
      { ...rule, conditions: { ...rule.conditions, mode: 'any' } },
      { ...context, goals: [] },
    ),
  );
  assert.equal(evaluateRule({ ...rule, is_active: false }, context), null);
  assert.equal(
    conditionSchema.safeParse({
      mode: 'all',
      conditions: [{ field: 'script', value: 'eval()' }],
    }).success,
    false,
  );
  assert.equal(
    conditionSchema.safeParse({
      mode: 'all',
      conditions: [{ field: 'score', min: 80, max: 10 }],
    }).success,
    false,
  );
  assert.equal(
    ruleInputSchema.safeParse({ ...rule, role: 'ADMIN' }).success,
    false,
  );
  assert.equal(
    submissionSchema.safeParse({
      assessmentVersionId: randomUUID(),
      idempotencyKey: randomUUID(),
      responses: context.responses,
      totalScore: 100,
    }).success,
    false,
  );
});
test('Phase 3 SQL/seed enforce atomic submission, owner RLS, immutable versions and recommendation history', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated,service_role;
 `);
    for (const file of [
      '202610160001_phase2_identity.sql',
      '202610160003_phase3_assessments.sql',
    ])
      await db.exec(
        await readFile(
          new URL('../supabase/migrations/' + file, import.meta.url),
          'utf8',
        ),
      );
    const seed = await readFile(
      new URL('../supabase/seed-phase3.sql', import.meta.url),
      'utf8',
    );
    await db.exec(seed);
    await db.exec(seed);
    assert.equal(
      (await db.query('select count(*)::int n from assessment_types')).rows[0]
        .n,
      4,
    );
    assert.equal(
      (await db.query('select count(*)::int n from assessment_questions'))
        .rows[0].n,
      32,
    );
    assert.equal(
      (await db.query('select count(*)::int n from recommendation_rules'))
        .rows[0].n,
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
    const assessment = (
      await db.query('select * from assessment_types order by id limit 1')
    ).rows[0];
    const version = (
      await db.query(
        'select * from assessment_versions where assessment_id=$1',
        [assessment.id],
      )
    ).rows[0];
    version.questions = (
      await db.query(
        'select * from assessment_questions where assessment_version_id=$1 order by display_order',
        [version.id],
      )
    ).rows;
    for (const q of version.questions)
      q.options = (
        await db.query(
          'select * from assessment_options where question_id=$1 order by display_order',
          [q.id],
        )
      ).rows;
    const responses = version.questions.map((q) => ({
      questionId: q.id,
      selectedOptionId: q.options.find((o) => o.score === 4).id,
    }));
    const score = scoreAssessment(version, responses);
    assert.equal(score.normalized_score, 100);
    const rule = (
      await db.query(
        'select * from recommendation_rules where assessment_id=$1 order by id limit 1',
        [assessment.id],
      )
    ).rows[0];
    const rec = evaluateRule(rule, {
      category: assessment.category,
      score: 100,
      feedback: score.feedback_category,
      responses,
      goals: [],
    });
    assert.ok(rec);
    const result = {
      ...score,
      result_snapshot: {
        assessment,
        scoring_config: version.scoring_config,
        questions: version.questions,
        recommendations: [rec],
      },
    };
    const key = randomUUID();
    async function submit(owner, submissionKey, hash, payload = responses) {
      return (
        await db.query(
          'select public.store_assessment_submission($1,$2,$3,$4,$5,$6,$7,$8) id',
          [
            owner,
            assessment.id,
            version.id,
            submissionKey,
            hash,
            JSON.stringify(result),
            JSON.stringify(payload),
            JSON.stringify([rec]),
          ],
        )
      ).rows[0].id;
    }
    await db.exec('set role service_role;');
    const attempt = await submit(alice, key, 'stable');
    assert.equal(await submit(alice, key, 'stable'), attempt);
    await assert.rejects(submit(alice, key, 'different'), /Idempotency/);
    await submit(alice, randomUUID(), 'retake');
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from user_recommendations where user_id=$1',
          [alice],
        )
      ).rows[0].n,
      1,
    );
    await db.query(
      "update user_recommendations set status='dismissed' where user_id=$1",
      [alice],
    );
    await submit(alice, randomUUID(), 'another-retake');
    assert.equal(
      (
        await db.query(
          'select status from user_recommendations where user_id=$1',
          [alice],
        )
      ).rows[0].status,
      'dismissed',
    );
    const count = (
      await db.query('select count(*)::int n from assessment_attempts')
    ).rows[0].n;
    await assert.rejects(
      submit(alice, randomUUID(), 'bad-option', [
        ...responses.slice(0, -1),
        { ...responses.at(-1), selectedOptionId: randomUUID() },
      ]),
      /foreign key/,
    );
    await assert.rejects(
      submit(alice, randomUUID(), 'missing-question', responses.slice(1)),
      /Missing required/,
    );
    assert.equal(
      (await db.query('select count(*)::int n from assessment_attempts'))
        .rows[0].n,
      count,
    );
    await assert.rejects(
      db.query(
        "update assessment_questions set question_text='Changed' where id=$1",
        [version.questions[0].id],
      ),
      /immutable/,
    );
    await assert.rejects(
      db.query('update assessment_options set score=2 where id=$1', [
        version.questions[0].options[0].id,
      ]),
      /immutable/,
    );
    await assert.rejects(
      db.query(
        "update assessment_versions set scoring_config='{}' where id=$1",
        [version.id],
      ),
      /immutable/,
    );
    await assert.rejects(
      db.query(
        'update assessment_attempts set normalized_score=0 where id=$1',
        [attempt],
      ),
      /immutable/,
    );
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${bob}',false);`,
    );
    assert.equal(
      (await db.query('select id from assessment_attempts')).rows.length,
      0,
    );
    assert.equal(
      (await db.query('select id from assessment_responses')).rows.length,
      0,
    );
    assert.equal(
      (await db.query('select id from user_recommendations')).rows.length,
      0,
    );
    await assert.rejects(
      db.query('select score from assessment_options'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select * from recommendation_rules'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('update assessment_types set title=$1 where id=$2', [
        'Tamper',
        assessment.id,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select public.publish_assessment($1,$2,0)', [
        assessment.id,
        version.id,
      ]),
      /permission denied/,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    assert.equal(
      (await db.query('select id from assessment_attempts')).rows.length,
      3,
    );
    assert.equal(
      (await db.query('select id from assessment_questions')).rows.length,
      32,
    );
    await db.exec('reset role;set role service_role;');
    const draftId = (
      await db.query('select public.start_assessment_draft($1) id', [
        assessment.id,
      ])
    ).rows[0].id;
    const definition = {
      scoring_config: version.scoring_config,
      questions: version.questions.map((q) => ({
        id: randomUUID(),
        question_text: q.question_text,
        question_type: q.question_type,
        is_required: q.is_required,
        options: q.options.map((o) => ({
          id: randomUUID(),
          option_text: o.option_text,
          score: o.score,
        })),
      })),
    };
    await db.query('select public.save_assessment_draft($1,$2,0,$3)', [
      assessment.id,
      draftId,
      JSON.stringify(definition),
    ]);
    await db.query('select public.save_assessment_draft($1,$2,1,$3)', [
      assessment.id,
      draftId,
      JSON.stringify(definition),
    ]);
    await assert.rejects(
      db.query('select public.save_assessment_draft($1,$2,0,$3)', [
        assessment.id,
        draftId,
        JSON.stringify(definition),
      ]),
      /Draft changed/,
    );
    await db.exec(
      `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${alice}',false);`,
    );
    assert.equal(
      (await db.query('select id from assessment_questions')).rows.length,
      32,
    );
    await db.exec('reset role;set role service_role;');
    await db.query('select public.publish_assessment($1,$2,2)', [
      assessment.id,
      draftId,
    ]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from assessment_versions where assessment_id=$1 and status='published'",
          [assessment.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          'select result_snapshot from assessment_attempts where id=$1',
          [attempt],
        )
      ).rows[0].result_snapshot.questions[0].question_text,
      version.questions[0].question_text,
    );
    assert.equal(await submit(alice, key, 'stable'), attempt);
    await assert.rejects(
      submit(alice, randomUUID(), 'old-version'),
      /no longer available/,
    );
  } finally {
    await db.close();
  }
});
