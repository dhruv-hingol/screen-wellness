# Development progress

Last updated: 2026-10-27 (Asia/Calcutta).

The workspace was empty: no repository, source files, or prior progress log existed. Implementation follows the supplied Phase 1 prompt. The Phase 1 record below is historical. Phase 2 local SQL verification is recorded separately; no remote migration or live seeding has occurred.

## Phase 1 — Monorepo, UI foundation, database design

- [x] New local `screenwise-wellness` directory with separate web/API apps.
- [x] pnpm workspaces, lockfile, Turborepo, strict TypeScript, ESLint and Prettier.
- [x] Node 24 engine and `.nvmrc`; application env examples and safe no-secret defaults.
- [x] Shared ESM package imports resolve in both apps; types, enums, Zod helpers and constants.
- [x] React/Vite/Tailwind foundation and 15 generated shadcn/Radix UI components.
- [x] Common page header, stat card, empty/loading states and global error boundary.
- [x] Query, Axios, router, toast, tooltip and reduced-motion providers; Zustand UI preferences.
- [x] Public landing, user/admin layout and every requested route implemented with explicit later-phase placeholders.
- [x] Express health endpoint, version prefix, security headers, CORS, Pino, validation and standard errors implemented.
- [x] Database design for all 18 entities, Mermaid ER diagram, PK/FK relationships, constraints, indexes, ownership, RLS, versioning and Storage planning.
- [x] Migration staging folder and intentionally empty seed SQL; no executable schema or connection.
- [x] Future API methods, routes, authorization, DTOs, pagination and error contracts documented.
- [x] README and architecture documentation.
- [x] Dependency installation completed using Node 24.22.0 and pnpm 10.18.3.
- [x] Strict typechecks passed for all three code packages.
- [x] ESLint passed for all three code packages.
- [x] Production builds passed for shared package, Express, and Vite.
- [x] Root `pnpm dev` started both apps; frontend HTTP 200 and direct/proxied health responses verified.
- [x] Chromium browser routing, dashboard/admin rendering, responsive navigation and persistent theme verification: 4 tests passed.
- [x] Prettier formatting applied; final check passed.

### Verification notes

The host initially had Node 22.14.0 and no pnpm command. Checks use an npm-exec-provisioned Node 24/pnpm toolchain; no global Node replacement was made. Registry/cache access and some Windows workspace directory creation required approved execution outside the sandbox. Use Node 24 plus pnpm 10.18.3 locally as documented in README.

Initial checks found a malformed JSX closing tag and an ESLint unused middleware parameter warning. Both were corrected; subsequent typecheck and lint runs passed. Browser tests are in `tests/foundation.spec.ts` and do not depend on live Supabase.

| Verification         | Actual result                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm install`       | Passed; lockfile generated; all six workspaces installed.                                                                                                                                                                            |
| `pnpm typecheck`     | Passed: shared, API, web; upstream shared build also passed.                                                                                                                                                                         |
| `pnpm lint`          | Passed: all three code packages; no errors/warnings.                                                                                                                                                                                 |
| `pnpm build`         | Passed: shared ESM/declarations, API dist, Vite static dist.                                                                                                                                                                         |
| `pnpm dev`           | Started Vite 7.3.7 on port 5173 and Express on 4000 together.                                                                                                                                                                        |
| HTTP checks          | Frontend returned 200. Direct `/api/v1/health` and Vite-proxied health returned the exact specified JSON.                                                                                                                            |
| `pnpm test:e2e`      | 4 tests passed in 10.1 seconds using Chromium; all 21 specified routes plus 404 checked.                                                                                                                                             |
| Browser interactions | Desktop sidebar collapse, user/admin navigation, dark/light switching and reload persistence passed. Mobile public/workspace menus, Escape dismissal and no horizontal overflow at 375 px passed. No page errors during route sweep. |
| API errors/security  | Browser-run request tests confirmed 404 envelope, malformed JSON 400, and nosniff security header.                                                                                                                                   |
| Visual review        | Full-page 1440 px desktop landing screenshot captured and inspected; artifact in ignored `test-results/landing-desktop.png`.                                                                                                         |
| Formatting           | `pnpm format` and final `pnpm format:check` passed.                                                                                                                                                                                  |

### Phase 1 completion and limitations

Phase 1 implementation and available verification are complete. No Phase 2 business features were implemented. The build emitted non-blocking upstream Zod PURE-comment warnings and a Vite chunk-size warning (main JS about 845 KB minified / 272 KB gzip). Route-level bundle splitting is a future performance improvement. Browser automation used Chromium only; this is not a full cross-browser, accessibility, or security audit. Database/RLS behavior is documented but deliberately not runtime-tested because no database exists in this phase. The local toolchain was provisioned through npm exec; developers still need Node 24/pnpm on their PATH to use the short commands directly. Shared-source edits require a shared rebuild or dev restart. No user-facing preview-opening tool was available; local HTTP and browser checks were used.

## Phase 2 - Authentication, database integration, onboarding and profiles

Status: implementation completed; local verification performed; **live Supabase acceptance pending configuration**. The supplied Phase 2 prompt supersedes the provisional Phase 1 roadmap. Work continued in the relocated D:\personal projects\screenwise-wellness project. No Git initialization or Phase 3 feature work occurred.

- [x] Inspected existing applications, shared packages, routing and Phase 1 documentation.
- [x] Added Supabase SDK clients and validated app env configuration, including legacy key aliases.
- [x] Added profiles/preferences/wellness-interest migrations with secure Auth triggers, email synchronization, checks, ownership, cascading deletes, and RLS.
- [x] Added server-only atomic onboarding/goal replacement functions and private avatar bucket policy.
- [x] Implemented signup, login, confirmation handling, forgot/reset/change password, PKCE, tab-persistent sessions, SDK refresh and local-scope logout.
- [x] Implemented protected/public-only/admin/onboarding guards, loading/error states and safe intended destinations.
- [x] Implemented token verification via Supabase Auth, trusted database-role authorization, input allowlists, owner-scoped services and rate limits.
- [x] Implemented all nine requested user route operations plus protected admin/access.
- [x] Implemented five-step onboarding with server-saved drafts, validation, progress and transactional final submission.
- [x] Implemented profile/wellness/appearance/security/notification settings, cache invalidation and private avatar upload.
- [x] Existing layouts now display authenticated profile data; open development access assumptions removed.
- [x] Updated README, architecture, database, API and setup/provisioning documentation.
- [x] Local schema/PostgreSQL tests passed (2 tests).
- [x] Production builds passed for shared, API and frontend.
- [x] Credential-free browser suite passed (4 tests).
- [x] Final strict typechecks, lint (no warnings/errors), and Prettier format check passed.
- [ ] Apply migrations to the intended live Supabase development project.
- [ ] Verify live signup/login/email confirmation/password recovery and token refresh.
- [ ] Verify live onboarding/profile/preferences/avatar round trips and session restoration/logout.
- [ ] Verify real two-user RLS isolation, invalid-token rejection and admin authorization.

### Local evidence

Node 24.22.0 and pnpm 10.18.3 are available in the relocated project. Dependencies installed successfully. Final pnpm typecheck, pnpm lint and pnpm format:check all passed. Typechecks initially passed, then a request-type augmentation refactor exposed a missing direct @types/express-serve-static-core dependency under pnpm isolation; that dependency was added and builds passed. React Hook Form watch lint warnings were corrected by using useWatch.

pnpm test: 2 tests passed. The PGlite test executes both migration files against isolated PostgreSQL with minimal test Auth/Storage relations. It verifies secure automatic provisioning (metadata ADMIN ignored), cross-user read isolation, denied browser role updates and RPC calls, valid constraints, unique goals on resubmission, transaction rollback, email synchronization, cascade deletion, and private Storage owner-read policy logic. This is not a live Supabase integration test.

pnpm test:e2e: 4 Chromium tests passed in 11.4 seconds. The tests started both dev apps and checked public health/security headers, unauthenticated API 401 responses, forbidden role-update request rejection without a session, malformed JSON, every private route redirecting to login, auth/recovery screens, explicit missing configuration, password visibility, mobile navigation, theme persistence and overflow. No page errors occurred in the private-route sweep. These tests do not simulate a signed-in user or claim a live login flow.

pnpm build: passed. Non-blocking upstream Zod comment warnings and Vite large-chunk warning remain (main JS approximately 1,147 KB minified / 355 KB gzip). Bundle splitting is a later optimization.

### Outstanding configuration and verification

Only .env.example files existed; no Supabase credentials were available. No hosted database migration, email delivery, live sign-in, refresh/recovery flow, account data write, upload, or remote RLS test was performed. Follow [Supabase setup](supabase-setup.md) to configure keys, execute migrations, configure SMTP/redirects/password policy and provision the first administrator. The code deliberately fails closed when configuration is missing.

Session persistence is tab-scoped sessionStorage, not browser-restart persistence; no remember-me checkbox is offered. Recovery PKCE links must be completed in the requesting tab. Local logout does not sign out other devices. Rate limits use an in-memory single-instance store. Avatar objects require an administrative cleanup workflow when deleting accounts; profile URLs expire after one hour. Settings may involve multiple requests; onboarding completion is atomic. Future functionality remains pending.

## Phase 3 - Assessments and personalized recommendations

Implementation and local verification completed; hosted acceptance is pending the Phase 3 migration and seed. The supplied Phase 3 prompt is implemented without prevention tracking or notification delivery.

- [x] Eight-table additive migration with RLS, foreign keys, immutable published content/history, transactional draft saves, publication and submission.
- [x] Four educational assessment seeds: 8 questions each (32 total), standard/reverse frequency scores, versioned bands, 8 safe recommendation rules.
- [x] Dynamic listing/questionnaire/review/results/history and compatible-version Recharts trends, with RHF/Zod and no browser-persisted assessment answers.
- [x] Backend membership validation, required/duplicate checks, deterministic normalization, zero-range handling, immutable snapshots and request idempotency.
- [x] Rule-based wellness plan, all/any conditions, status updates, goal-interest matching, explicit refresh and recommendation deduplication.
- [x] Admin metadata/question/option/order builder, interactive preview, draft cloning, optimistic revision checks, publish/archive actions and rule builder.
- [x] Existing auth guards/ownership and uppercase roles reused. Static API routes registered before dynamic IDs.
- [x] Typechecks, lint and first production build passed.
- [x] 5 local schema/scoring/PostgreSQL tests passed, including existing Phase 2 tests.
- [x] 4 Chromium credential-free tests passed in 10.7 seconds, including new private routes and API rejection.
- [ ] Apply Phase 3 migration and seed to hosted Supabase.
- [ ] Verify signed-in user/admin UI and complete HTTP persistence flows against hosted Supabase.

Read-only hosted checks during this work confirmed profiles/preferences now exist. assessment_types, assessment_versions and recommendation_rules returned PGRST205 (not installed). A direct database connection was not configured, so no hosted SQL was executed. The local SQL tests execute the real migration and seed with PGlite; they are not hosted Supabase verification. Real browser tests cover public/unauthenticated behavior only. Full live user/admin flows remain unverified. Non-blocking Zod annotation and Vite large-chunk warnings remain.

Scoring directions and seeds: [assessment-scoring.md](assessment-scoring.md). SQL: migrations/202610160003_phase3_assessments.sql then supabase/seed-phase3.sql. Apply with the SQL editor (separate files in order), or psql with a configured DATABASE_URL. Retries of submissions reuse their idempotency key and same answers; different answers require a new key. Completed/dismissed rule revisions are not automatically reissued. Edited rule content is versioned through its revision and future recommendations keep snapshots. Daily goals/prevention are Phase 4.

## Phase 4 — Prevention, activities, goals, and notifications

Implementation and local verification completed on 2026-10-18; **hosted setup and signed-in acceptance remain pending**. The supplied Phase 4 request supersedes the old roadmap: library/content work is Phase 5 and analytics/PDF work is Phase 6. Existing Phase 4 source was inspected and extended; no project recreation or Git initialization occurred.

- [x] Additive wellness migration: seven tables, RLS, owner read policies, checks/FKs/indexes, UTC timestamps, transactional functions, snapshots, and completion idempotency.
- [x] Additional `202610180005_phase4_integrity.sql`: minimum timer elapsed validation, active-activity filtering index, history-array constraints, and recommendation revision preservation for link-only changes.
- [x] Sixteen idempotent educational activity seeds across eye, posture, movement, sleep, and digital-break categories; Phase 3 rule links.
- [x] Authenticated activity/session/history/checklist, goal/progress/summary, reminder, notification/read-state, and trusted-admin activity APIs.
- [x] Prevention dashboard with featured timer, saved daily summary, category shortcuts, suggested checklist activities, debounced filters, pagination, and completion state.
- [x] Guided steps, previous/next actions, elapsed-time display, safety guidance, explicit completion confirmation, cancellation, and immutable server snapshots.
- [x] Timestamp-based focus/break timer with pause/resume/reset, navigation persistence, validated paused refresh restoration, account clearing, and explicit backend completion.
- [x] Saved historical daily checklists, accurate date-specific completion labels, editable checklist timezone, and goal links.
- [x] Goal creation/editing, pause/resume/archive, associated activities, summary cards, backend daily/weekly progress, current/longest streaks, and pause/definition history.
- [x] Reminder schedules, global delivery preference, explicit browser-permission handling, active-tab polling, backend cross-tab deduplication, and notification history/read controls.
- [x] Related-activity actions on recommendations and configurable admin rule links; activity completion preserves explicit recommendation status.
- [x] Fixed a pre-existing recommendation evaluation defect: persisted rule metadata is no longer passed into a strict request schema; conditions are validated separately.
- [x] Archived goal history excludes later completions; malformed persisted timer state cannot override store methods.
- [x] Updated README, architecture, database/API/setup documentation and feature READMEs; added [Phase 4 behavior and setup](phase4-wellness.md).
- [ ] Install pending Phase 3 and Phase 4 migrations/seeds in hosted Supabase.
- [ ] Verify real signed-in assessment/activity/goal/reminder/notification/admin HTTP round trips and two-user hosted RLS.

### Actual verification

Follow-up integrity checks also passed for immutable archive timestamps and archive retry/resume rules. The browser checks cover native permission-denied guidance, the bell's mark-all-read action, and explicit permission requests using a browser-only Notification API fixture. Headless Chromium retained `denied` despite a permission override, so the fixture verifies default/granted UI behavior and that no permission request occurs before a click. Native granted notification delivery remains unverified.

| Command / check               | Result                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                   | 11 tests passed. Executes real migrations and idempotent seeds in isolated PGlite PostgreSQL, plus scoring/service/timer tests.                                                     |
| `pnpm test:e2e`               | 7 Chromium tests passed in 21.0 seconds: 4 public/auth-guard/API checks and 3 isolated Phase 4 UI fixture checks.                                                                   |
| `pnpm typecheck`              | Shared, API, and web strict checks passed.                                                                                                                                          |
| `pnpm lint`                   | All three code packages passed.                                                                                                                                                     |
| `pnpm build`                  | Shared/API/Vite production builds passed. Upstream Zod annotation and Vite large-chunk warnings remain.                                                                             |
| `pnpm format:check`           | Passed across the workspace.                                                                                                                                                        |
| Read-only hosted schema probe | `profiles`: HTTP 200. `assessment_types`, `recommendation_rules`, `wellness_activities`, `activity_sessions`, `wellness_goals`, `daily_wellness_checklists`: HTTP 404 / `PGRST205`. |

SQL coverage includes server-owned timestamps/durations, minimum timer time, expired-session rejection, repeated completion/start deduplication, owner isolation, denied direct browser writes/RPCs, atomic goal links/rollback, retained definition history, daily snapshot persistence, notification enablement/deduplication, and seed linking without revision changes. Progress tests cover local midnight/DST, missed days, pauses, weekly boundaries, linked activities, and archive cutoff. Existing Phase 2/3 tests also passed.

Browser UI tests use real components and routes with **explicit test-only intercepted identity/HTTP fixtures**; production APIs are database-backed. They exercise guided steps/completion, current-date checklist feedback, sidebar alignment/mobile navigation, clock throttling/navigation/refresh/pause/resume and explicit saving, goal lifecycle, reminder forms, timezone validation, and notification read actions. They do not demonstrate real authenticated Supabase persistence. No live user credentials were supplied or invented.

### Configuration and limitations

API environment credentials exist. Hosted Phase 3/4 tables are absent, and no direct database connection is configured, so no hosted migration/seed writes were performed. Apply pending files using [documented commands](phase4-wellness.md#apply-migrations-and-seeds) or the SQL editor, then restart the apps and complete signed-in acceptance. Earlier phase completion statements are local evidence, not a hosted acceptance claim.

Reminders require an active visible tab, enabled global delivery and enabled schedules; closed-browser delivery is not guaranteed. Browser permission is explicitly requested. Guided sessions are self-reported; elapsed time does not measure exercise/sleep. Old goal definitions are retained without formula replay. Initial JS bundle remains large (approximately 1,648 KB minified / 501 KB gzip); route splitting is a later performance improvement. Cross-browser, accessibility and security audits remain pending.

## Phase 5 — Health library and integrated content management

Implementation, local checks and bounded live CMS/Storage/RLS acceptance completed on 2026-10-18. **Hosted database readiness still requires review/application of `005` and `007`.** The Phase 3/4 core tables and Phase 5 tables/bucket are now present, superseding earlier missing-table observations. No project recreation, Git initialization, database reset, or Phase 6 work occurred.

- [x] Inspected existing migrations, auth, recommendations, prevention/admin tools, and hosted dependency state before implementing.
- [x] Added `202610180006_phase5_library.sql`: seven content/taxonomy/bookmark/media tables, FKs/indexes/constraints, update/revision triggers, trusted admin helper, RLS, transactional content/status/reference functions, and public-by-URL Storage setup.
- [x] Added `202610180007_phase5_conflicts.sql` after live verification exposed normal business conflicts triggering hosted serialization retries. It preserves functions/privileges and replaces only those SQLSTATE values with `PT409`, plus a readiness marker.
- [x] Published library homepage, featured content, backend indexed/debounced search, categories/tags/sort/pagination, article cards, loading/error/empty states and saved articles navigation.
- [x] Safe React rich-text reader, publication/author/reading metadata, source references, table of contents, bookmark controls, and database-derived related articles.
- [x] Owner-persisted idempotent bookmarks and graceful unavailable-article links without draft leaks.
- [x] Admin article list/filtering, create/edit forms, lazy-loaded TipTap editor, structured document validation/canonicalization, draft previews, publication/unpublication/archive/restore and revision conflicts.
- [x] Backend-derived configurable reading time, HTTPS references, explicit editorial review gate and preserved author snapshots.
- [x] Real protected media upload/download: byte/MIME validation, 5 MB limit, pixel/dimension checks, metadata removal, WebP normalization, UUID paths, transactional references and unused-object cleanup.
- [x] Category/tag creation/editing/order/activation, safe category deactivation, and used-tag deletion protection.
- [x] Real content-count admin overview and quick actions; existing activity management links to filtered recommendation rules without rebuilding working modules.
- [x] Six categories, six tags, twelve original educational articles in an idempotent SQL seed with verified background references; no invented endorsements or fake user completions.
- [x] Applied the library seed through the optional server-only REST script against the installed schema. First run inserted 6/6/12; repeat inserted 0/0/0 and preserved existing content.
- [x] Added read-only schema diagnostics, explicit live verification/cleanup scripts, and updated required documentation.
- [ ] Reconcile/apply pending Phase 4 integrity migration `005`: `wellness_goals.archived_at` is still missing in the hosted project.
- [ ] Apply Phase 5 conflict patch `007`: its service-only marker remains absent; fresh installs require it after `006` too.

### Actual verification

| Command/check            | Actual result                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`              | 15 tests passed, covering existing phases plus real Phase 5 PostgreSQL schema/seed/RLS/transactions, rich-text safety, image bytes and reading metrics.                                                                                                                                           |
| `pnpm test:e2e`          | 10 Chromium tests passed in 28.3 seconds: existing public/auth guards and Phase 4 flows, plus library/CMS/taxonomy UI fixtures.                                                                                                                                                                   |
| `pnpm typecheck`         | Shared/API/web strict checks passed.                                                                                                                                                                                                                                                              |
| `pnpm lint`              | All code packages passed.                                                                                                                                                                                                                                                                         |
| `pnpm build`             | Shared/API/Vite production builds passed. TipTap editor is a separate lazy chunk; existing dependency annotation and main-chunk warnings remain.                                                                                                                                                  |
| Live Supabase acceptance | Passed real confirmed sign-in, drafts/edits, publication validation/lifecycle, conflict prechecks, search/category/tag/sort/pagination, related articles, bookmarks and two-user RLS, media upload/download/validation/in-use protection, taxonomy, overview and existing domain endpoint checks. |
| Live cleanup             | All disposable test articles/media/tags/categories/bookmarks and three newly created accounts removed; no email was sent. Existing accounts/content were not altered by acceptance fixtures. Permanent seed content was installed separately.                                                     |
| Hosted seeding           | Inserted 6 categories, 6 tags, 12 published articles. Immediate repeat inserted 0/0/0.                                                                                                                                                                                                            |
| `pnpm db:check-content`  | Intentionally exits nonzero: core/schema tables and bucket exist, but Phase 4 `archived_at` and the Phase 5 conflict marker are missing. This is a pending setup result, not a passed readiness check.                                                                                            |

Local PostgreSQL coverage includes draft/admin isolation, two-user bookmarks, denied direct writes/RPCs, duplicate prevention, safe deactivation, atomic tag rollback, revision conflicts, explicit `PT409`, registered-media reference protection/deletion, unavailable bookmarks, indexed word search and seed repeatability without overwriting edits. Content tests reject executable/unsupported elements, handler attributes, dangerous URL schemes, excessive depth and forged mutation fields. Upload tests validate actual bytes, MIME, size and normalized output.

Browser tests use **explicit test-only identity/HTTP fixtures** around real components and routes. They cover search/category/tag/sort/pagination, safe escaped rich text, related cards, bookmarks/unavailable links, mobile overflow, TipTap content, custom slug editing, source review, cover uploads, saved preview, publication lifecycle, category/tag creation, real-count overview rendering and non-admin UI denial. Existing prevention/timer/goals/reminder/notification and auth guard tests remain passing. Native hosted persistence is established separately by the live script, not claimed from fixtures.

Live verification found and helped fix a slug autofill race, deterministic conflict timeouts, and a long expanded guard test. Slug generation now stops when manually edited. Service prechecks return prompt stale/in-use errors. `007` handles remaining database race conflicts without transient serialization retry signals. Browser concurrency is bounded to four workers; the expanded private-route sweep has a 60-second total budget while individual assertions retain their limits.

### Hosted state, commands, and remaining limits

The agent used existing Supabase credentials without printing keys, tokens, passwords, or personal records. It did not execute hosted SQL. During this turn the Phase 5 schema/bucket became available externally; hosted acceptance then used those real structures. The initial probe found Phase 3/4 core tables present and no Phase 5 tables. Later probes found Phase 5 tables and a public 5 MB bucket, but no `archived_at` or conflict marker. There is no direct database connection configured.

For this observed project, **do not rerun `006`**. Review/apply `005` if pending, then `007`, as documented in [Phase 5 setup](phase5-library.md). The SQL seed is safely repeatable and the hosted seed is already present. `pnpm db:check-content`, `pnpm db:seed-library --run`, and `pnpm verify:phase5-live --run` provide explicit checks/setup paths. The latter creates only disposable verification resources and performs scoped cleanup; builds should be finished before using a stable compiled API for live checks.

Public media URLs are intentional even for draft covers; upload controls disclose this. A process interruption during media deletion can leave a reserved row requiring administrative review. Cross-browser/accessibility/performance audits, native granted browser notifications, SMTP/recovery, and exhaustive hosted assessment-submission acceptance are not newly claimed. Published seed content is general education with verified background references, not clinical validation. No Phase 6 analytics or PDF work was started.

## Phase 6 — Dashboard, analytics, reports and integration

Implemented and locally verified on **2026-10-26 (Asia/Calcutta)**. **Hosted Phase 6 acceptance remains pending `005` and `008`.** No project recreation, Git initialization, hosted SQL execution, Phase 7 campaign or Phase 8 deployment was performed.

- [x] Audited Phase 1–5 source, schema/migrations, trusted auth/role guards, recommendations, wellness progress and content management.
- [x] Added shared strict TypeScript reporting contracts, Zod date validation and outgoing dashboard/analytics/report validation.
- [x] Added owner-bound dashboard and selected-range analytics endpoints, plus trusted-admin aggregate endpoints.
- [x] Added additive `202610260008_phase6_analytics.sql`: three aggregation indexes, service-only invoker functions, fixed search paths, existing RLS/unique constraints preserved.
- [x] PostgreSQL aggregation provides zero-filled local days, historical snapshot categories, compatible assessment groups, paginated timeline/history and per-goal daily counts.
- [x] Reused Phase 4 goal progress/streak rules without loading every historical session into the new dashboard.
- [x] Replaced dashboard/progress/admin-analytics placeholders with actual API-driven metrics, Recharts visualizations, relevant actions, accessible summaries and loading/error/empty states.
- [x] Added saved-checklist progress using distinct planned activity IDs, so repeated sessions cannot inflate the percentage.
- [x] Implemented authenticated selected-range jsPDF reports with embedded licensed font, wrapped long content, page breaks, page numbering and a disclaimer on every page.
- [x] Added admin suppression using five distinct contributors, static category lists and joint suppression of linked behavioral panels/totals to reduce cross-panel inference.
- [x] Centralized identity/filter query keys and mutation invalidation across assessments, recommendations, activities, goals, preferences and admin content. Notification read operations keep bell/history synchronized without analytics refetches.
- [x] Priority-ordered active recommendations display related active activity titles and library searches; archived activities do not leave broken start links. Completion keeps explicit recommendation status.
- [x] Lazy-loaded chart pages/report generator and added Vite jsPDF pre-optimization to prevent a first-export development reload.
- [x] Standardized app-wide dropdown chevrons/padding, dark/native option colors, keyboard focus, Radix popup sizing/positioning and account-menu icon alignment.
- [x] Standardized validation text and accessible field errors/summaries across authentication, onboarding, profile/settings, assessments, goals, reminders and admin activity/assessment/rule/category/article forms. Backend validation returns minimized friendly issues; network/timeout/auth errors have actionable messages.
- [x] Fixed desktop and mobile sidebar scroll containers, short-screen layout, and thin themed scrollbars across the application.
- [x] Fixed the reported missing `validationIssueMessage` export by rebuilding shared output, verified the compiled export, added shared watch mode to dev scripts, and started a watcher for the current editing session.
- [x] Updated README, architecture, database, API, SQL setup instructions and the detailed [Phase 6 guide](phase6-analytics.md).
- [ ] Apply missing hosted `005`, then new `008`; retain already installed `006` and `007`.
- [ ] Verify real signed-in hosted dashboard/report/assessment/activity/goal/admin journeys and two-user HTTP isolation after migration setup.

### Actual verification

| Command/check                                       | Actual result                                                                                                                                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`                                    | Passed for shared, API and web after app-wide validation changes.                                                                                                                                    |
| `pnpm lint`                                         | Passed for all three code packages.                                                                                                                                                                  |
| `pnpm build`                                        | Shared, API and Vite production builds passed. Chart pages, report generator and font emit separate assets.                                                                                          |
| `pnpm test`                                         | 17 local tests passed, including existing Phases 2–5 and real Phase 6 SQL with isolated PostgreSQL/Auth/Storage scaffolding.                                                                         |
| `node --test tests/phase6.test.mjs`                 | 2 focused tests passed again after final admin suppression changes.                                                                                                                                  |
| `pnpm test:e2e`                                     | Full existing 13-check Chromium suite passed with Phase 6 report/filter/guard scenarios.                                                                                                             |
| `pnpm exec playwright test tests/phase6-ui.spec.ts` | 4 focused checks passed after adding all five onboarding screens and short desktop/mobile sidebar, dark dropdown and keyboard-focus checks. Across the two runs, all 14 unique browser cases passed. |
| Visual review                                       | Inspected responsive progress and dark account-menu screenshots. Real PDF artifact downloaded successfully.                                                                                          |
| Shared export                                       | Compiled `validationIssueMessage` and `fieldLabel` verified as functions; shared watch compilation reported zero errors.                                                                             |
| `pnpm db:check-content`                             | Correctly failed readiness: hosted `archived_at` is missing. Existing content tables/bucket and conflict patch `007` are present.                                                                    |
| `pnpm db:check-analytics`                           | Correctly failed readiness: `005` missing (42703), `007` installed, new `008` RPCs absent (PGRST202). No hosted SQL executed.                                                                        |

Local SQL checks cover owner isolation, service-only function permissions, non-admin database rejection, DST local boundaries, completed-session counts, archived activity snapshots, separate scoring groups, pagination, goal parity and small-group suppression. Browser identity/API data is explicitly fixture-only; production code uses authenticated PostgreSQL-backed APIs. Checks include actual PDF bytes/download and selected dates, native dropdown choices, error recovery, mobile overflow, all five onboarding screens, scrollable short-screen navigation, account-menu dismissal/focus and admin UI denial. They do not establish real hosted authenticated persistence.

### Remaining limitations and phase status

Phases 1–5 retain their documented implementation and acceptance evidence; outstanding earlier hosted Auth/recovery/notification acceptance is not newly claimed. Phase 6 implementation and available local verification are complete, **but Phase 6 is not marked fully accepted while hosted prerequisites and signed-in acceptance remain pending**. The 2026-10-26 live probe supersedes the older note that `007` was missing.

Historical goal reports evaluate currently saved definitions/status at the selected end date; old goal definitions/status transitions are retained rather than replayed. No goal-achievement event timestamps exist, so timeline milestones are not fabricated. PDF Unicode support is limited to the bundled font repertoire and jsPDF shaping. The existing large main bundle warning remains (about 1,696 KB minified / 514 KB gzip), along with upstream Zod annotation warnings. Turbo reported a Git ownership warning after a repository appeared externally; no global Git configuration or Git initialization was performed by this task. None of these warnings failed the checks.

The sidebar/dropdown/error follow-ups stay within application integration. Formal cross-browser/accessibility/security/performance/UAT work remains **Week 7**; production deployment/operations remain **Week 8**.

### 2026-10-27: partial migration repair

Repeated 42P07 reports identified an unconditional index statement remaining in the original 005 migration even after a separate repair file had been prepared. The original migration now guards existing indexes/columns/triggers/constraints, replaces its archive trigger function safely, and backfills only missing archive cutoffs. The combined setup file was regenerated with version 2026-10-27-r2 and restores 008 functions/permissions plus schema-cache reload. The readiness script now names the exact repair file and explains that it does not execute SQL.

Actual verification: node --test tests/phase4.test.mjs tests/phase6.test.mjs passed all 8 checks, including a pre-existing activities_category_duration index, repeated original 005 and complete repair execution, service-only RPC permissions, reporting aggregation and unchanged archived goal records. No hosted SQL execution is claimed. Both affected endpoints still require successful hosted setup before their 503 can be resolved.

### 2026-10-27: published assessments and goal activity catalog

Live inspection found no published assessments, one existing Exercise draft, and an empty activity catalog. At the user's request, server-only REST setup published the four existing Phase 3 definitions (Eye Discomfort, Posture and Ergonomics, Sleep Habits, Digital Fatigue), each with eight questions/five choices and two recommendation rules. The existing Exercise draft was preserved. The missing sixteen Phase 4 activities were then inserted and all eight new recommendation rules linked to their relevant active activity.

New db:seed-assessments and db:seed-activities commands use checked-in SQL content as their source, shared validation, existing transactional assessment publication services, and server-only credentials. Without --run they are read-only previews. Existing slugs/IDs are checked and existing content is not overwritten. Immediate repeated runs reported zero new assessments, zero rules, zero activities and zero new links; four seeded assessments and sixteen activities were preserved.

The empty catalog caused the goal activities validation error. The goal form now explains that at least one activity must be selected, displays an explicit empty-category state, disables saving when no choices exist, and shows loading/retry feedback when activities cannot load. Activity checkboxes have names and error associations for focus and validation. No empty goal or fabricated completion was saved.

Actual verification: published definitions loaded through the real backend service with eight questions and five options each, with option scores hidden from user-facing DTOs; hosted active activity count is sixteen across eye comfort, posture, movement, sleep and digital break. Strict shared/API/web typechecks passed on a sequential rerun after one transient pnpm workspace-state JSON read failure. The seed content integrity check passed. The focused goal/reminder Chromium flow passed, including required-selection feedback followed by successful goal creation. Browser interaction data remains explicit test fixtures; no user account or user goal was created for verification.
