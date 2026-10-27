# Supabase migrations

Apply only unapplied SQL files in filename order: `001` identity, `002` avatars, `003` assessments, `004` wellness, `005` wellness integrity, `006` library/Storage, `007` library conflicts. Seeds are separate: `../seed-phase3.sql`, `../seed-phase4.sql`, then `../seed-phase5.sql` as needed. Do not rerun create-table migrations on existing relations.

Current hosted checks found Phase 3/4 core tables and Phase 5 tables/bucket present. `wellness_goals.archived_at` is missing and `library_conflict_code()` is absent: review/apply pending `005`, then `007`. **Do not rerun `006`** on that hosted project. If `005` was partially applied, inspect its actual objects/history first. Run `pnpm db:check-content` from the root for read-only checks. Full [Phase 5 migration, Storage and seed instructions](../../docs/phase5-library.md) include exact commands and actual verification results.

## Phase 6

`202610260008_phase6_analytics.sql` is additive and runs after `001`–`007`; `005` must supply the archive cutoff. It creates aggregate indexes and service-only invoker RPCs without rewriting data or adding fake records. Apply once. On the hosted project observed 2026-10-26, `005` remains pending, `006`/`007` are present, and `008` is absent: review/apply `005`, retain installed migrations, then apply `008`. See [Phase 6 setup](../../docs/phase6-analytics.md) and run `pnpm db:check-analytics`. Seeds remain separate.
