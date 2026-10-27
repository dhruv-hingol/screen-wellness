# Seed scoring directions

All questions ask about the past two weeks. Never/Rarely/Sometimes/Often/Very often score 0/1/2/3/4 for concern-oriented questions, and 4/3/2/1/0 for healthy-habit questions. Higher totals consistently indicate more reported concerns. All seeded questions are required.

## Eye Discomfort

| Question                                                             | Direction                                   |
| -------------------------------------------------------------------- | ------------------------------------------- |
| 1. I noticed dry or gritty sensations in my eyes during screen use.  | Standard: 0 to 4 (concern frequency)        |
| 2. My vision felt temporarily blurred after prolonged screen use.    | Standard: 0 to 4 (concern frequency)        |
| 3. My eyes felt tired by the end of screen sessions.                 | Standard: 0 to 4 (concern frequency)        |
| 4. I took visual breaks during extended screen sessions.             | Reverse: 4 to 0 (healthier habit frequency) |
| 5. I adjusted glare or brightness when my screen felt uncomfortable. | Reverse: 4 to 0 (healthier habit frequency) |
| 6. I continued screen use despite eye discomfort.                    | Standard: 0 to 4 (concern frequency)        |
| 7. I positioned my screen at a comfortable viewing distance.         | Reverse: 4 to 0 (healthier habit frequency) |
| 8. I noticed discomfort after a long uninterrupted screen session.   | Standard: 0 to 4 (concern frequency)        |

## Posture and Ergonomics

| Question                                                             | Direction                                   |
| -------------------------------------------------------------------- | ------------------------------------------- |
| 1. I noticed neck discomfort during or after screen use.             | Standard: 0 to 4 (concern frequency)        |
| 2. My shoulders felt tense during desk work.                         | Standard: 0 to 4 (concern frequency)        |
| 3. I remained seated for long periods without changing position.     | Standard: 0 to 4 (concern frequency)        |
| 4. I adjusted my workstation to support a comfortable posture.       | Reverse: 4 to 0 (healthier habit frequency) |
| 5. I stood up or moved between extended screen sessions.             | Reverse: 4 to 0 (healthier habit frequency) |
| 6. I noticed myself leaning toward the screen for long periods.      | Standard: 0 to 4 (concern frequency)        |
| 7. I checked whether my keyboard and screen felt comfortable to use. | Reverse: 4 to 0 (healthier habit frequency) |
| 8. I ignored physical discomfort to continue working on a device.    | Standard: 0 to 4 (concern frequency)        |

## Sleep Habits

| Question                                                                  | Direction                                   |
| ------------------------------------------------------------------------- | ------------------------------------------- |
| 1. I used devices later at night than I intended.                         | Standard: 0 to 4 (concern frequency)        |
| 2. I kept a reasonably consistent bedtime routine.                        | Reverse: 4 to 0 (healthier habit frequency) |
| 3. I used stimulating digital content immediately before trying to sleep. | Standard: 0 to 4 (concern frequency)        |
| 4. I found it difficult to wind down after evening screen use.            | Standard: 0 to 4 (concern frequency)        |
| 5. Digital notifications interrupted my intended rest time.               | Standard: 0 to 4 (concern frequency)        |
| 6. I felt tired when starting my morning routine.                         | Standard: 0 to 4 (concern frequency)        |
| 7. I set aside time to relax away from screens before bed.                | Reverse: 4 to 0 (healthier habit frequency) |
| 8. I checked my device when I intended to be sleeping.                    | Standard: 0 to 4 (concern frequency)        |

## Digital Fatigue

| Question                                                             | Direction                                   |
| -------------------------------------------------------------------- | ------------------------------------------- |
| 1. I found concentration difficult after prolonged device use.       | Standard: 0 to 4 (concern frequency)        |
| 2. I felt mentally tired after a long screen session.                | Standard: 0 to 4 (concern frequency)        |
| 3. I took planned pauses during device-heavy tasks.                  | Reverse: 4 to 0 (healthier habit frequency) |
| 4. I felt overwhelmed by digital notifications.                      | Standard: 0 to 4 (concern frequency)        |
| 5. I used screens for longer uninterrupted sessions than intended.   | Standard: 0 to 4 (concern frequency)        |
| 6. I found it difficult to disconnect from devices when I wanted to. | Standard: 0 to 4 (concern frequency)        |
| 7. I made space for activities away from screens.                    | Reverse: 4 to 0 (healthier habit frequency) |
| 8. I switched between digital tasks so often that it felt tiring.    | Standard: 0 to 4 (concern frequency)        |

## Normalization and feedback

Total = sum of selected option scores. Minimum/maximum = sum of each answered question's minimum/maximum option score. Optional unanswered questions are excluded from both bounds. Normalized = 100 * (total-min)/(max-min), rounded to two decimals. If max=min, score is 0. Seeded boundaries are 0, 34, and 67, with lower/moderate/higher reported concern respectively. They are custom educational groupings, not clinical classifications. Backend publication computes a compatibility fingerprint from category, ordered wording, required flags, options/scores, and band configuration. Changed scoring or wording creates a separate trend group. Historical results preserve the definition and feedback snapshot used at submission.

## Installing the published definitions

For an installed schema without a direct SQL connection, build shared/API output and run pnpm db:seed-assessments for a read-only preview, or pnpm db:seed-assessments --run to add and publish only missing seed slugs. The existing transactional draft/save/publish services validate definitions and compute scoring fingerprints. Existing assessments, including administrator drafts, remain unchanged. The original supabase/seed-phase3.sql remains the source of questionnaire/rule content.

Goal tracking also needs activities. pnpm db:seed-activities previews missing Phase 4 activity definitions; adding --run inserts only missing slugs and links unassigned seed recommendation rules to available activities. The 2026-10-27 hosted setup added four published assessments, eight rules and sixteen activities. Repeats created no duplicates. Server credentials remain in apps/api/.env and must never be included in browser builds.
