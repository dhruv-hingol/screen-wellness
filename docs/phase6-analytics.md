# Phase 6: dashboard, analytics and reports

Implemented in the existing monorepo on 2026-10-26 (Asia/Calcutta). This guide distinguishes implemented local features from hosted acceptance. Phase 7 formal testing and Phase 8 deployment are outside this change.

## Database setup

Run `pnpm db:check-content` and `pnpm db:check-analytics` first. Both are read-only and print dependency status rather than credentials or personal records.

The read-only hosted check on 2026-10-26 found Phases 2–5 core tables and the article bucket present. Patch **007 is now installed**, superseding the previous progress entry. `wellness_goals.archived_at` from **005 is still absent**. No direct database URL is configured. Hosted SQL has not been executed during Phase 6.

For this observed existing project:

1. Review the migration history and apply `supabase/migrations/202610180005_phase4_integrity.sql` if still missing. It preserves existing data and supplies the archive cutoff and timer/recommendation integrity rules.
2. Keep the existing `006` tables and installed `007` patch. Do not rerun historical create-table migrations or seeds blindly.
3. Apply **`supabase/migrations/202610260008_phase6_analytics.sql` once**, after all dependencies through `007` are present.
4. Run both readiness commands again, rebuild/restart the applications, then perform signed-in hosted acceptance.

Use the Supabase SQL editor, one complete file at a time in the order above. Alternatively, with an explicitly configured direct connection, run `psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f <file>` in PowerShell for each pending file. Do not paste server credentials into chat or frontend configuration.

Fresh databases apply `001`–`008` once in filename order. Seeds remain separate: Phase 3 definitions, Phase 4 activities, and Phase 5 library seed only as appropriate. Phase 6 has no seed data and creates no users, fake completions or summary tables.

Migration `008` adds three indexes and four service-only functions: personal aggregation, dashboard summary, admin aggregation and small-group suppression. Existing owner/date and goal-link indexes are reused. Functions use invoker privileges and an empty search path. EXECUTE is revoked from PUBLIC, anon and authenticated and granted only to service_role. Existing table RLS remains intact. The API binds personal RPC ownership to the verified Auth identity; admin access checks the trusted profile role in middleware and again inside its RPC.

## Reporting rules

### Repairing a partially installed hosted schema

If SQL execution reports `42P07: relation "activities_category_duration" already exists`, use `supabase/setup-phase6-pending.sql`, repair version **2026-10-27-r2**. The original `005` migration now also guards existing indexes, columns, triggers and constraints, so reopening that source no longer contains the unconditional index statement. The complete repair backfills only missing archive cutoffs and restores current function definitions/permissions. It includes `005` repair, `008` setup and the PostgREST schema-cache reload. Reopen the file and copy its complete updated contents into a **new** Supabase SQL Editor query; an already-pasted query does not update when local files change. Local PostgreSQL checks reproduce the pre-existing-index case, repeat both the original migration and complete repair, and verify archived goal records remain unchanged. Eight Phase 4/6 checks passed on 2026-10-27. The agent has not executed hosted SQL.

- Default range: 30 days. `7d`, `30d` and `90d` include the current day in saved preferences.timezone. Custom ranges include both local dates, reject future dates, and are limited to 366 days between 2000 and 2100.
- PostgreSQL converts local midnight and the following end-date midnight separately into timestamptz boundaries. Queries use `[start, next-day-end)`, including daylight-saving changes correctly. Daily activity charts fill missing local dates with zero and sort chronologically.
- Only completed sessions with valid completion timestamps count. Each persisted session counts once. Existing unique owner/idempotency keys and checklist completion constraints prevent retry duplicates. Snapshot categories/titles retain historical meaning when a definition is archived.
- Dashboard session totals include intentional repeat sessions. Checklist progress counts distinct completed activities in the saved checklist; repeats cannot inflate its percentage. No target is invented when no checklist is saved.
- Assessment series group by assessment ID and compatibility fingerprint. Category filtering affects only assessment series/result history; activity, goal and summary totals retain the complete reporting period. Different questionnaires and incompatible scoring versions are never joined into one score. These are educational, self-reported scores, not clinical outcomes.
- Detailed timeline and assessment history accept page/pageSize (1–100 rows); timeline sorting uses descending event timestamp and ID. Complete selected-range chart series are aggregated in PostgreSQL, independent of the displayed history page.
- Goal metrics reuse Phase 4 calculation code through `goalProgressFromCounts`; PostgreSQL supplies daily counts per linked goal rather than all raw lifetime sessions. Each goal retains its own timezone. Archive timestamps, tracking_start, start/end dates, pause ranges, Monday-based weekly periods and unfinished-current-period streak rules remain authoritative.
- Goal current-period progress and streak are evaluated at the selected end date (capped at now). Range achievement uses unpaused goal periods whose start date is within the selected dates and counts completions within those dates. A partial leading weekly period is excluded from that achievement denominator. Current-period progress can include earlier days in its week; the UI and report label this explicitly.
- Goal definitions/status are the currently saved definitions, with existing definition history retained but not replayed. A report is not an event-sourced reconstruction of old goal edits/status transitions. Goals created or with tracking dates after a historical range produce no eligible periods. The featured streak identifies its source goal and unit; other goals retain their own streak values.
- Timeline includes persisted assessments and activity completions. Phase 4 does not persist goal-achievement events; no milestone timestamp or achieved-goal event is fabricated.
- Up to five active recommendations are ordered by priority, then newest creation and ID. Related active activity titles/actions and category-based library search links connect the plan to prevention and reading. Archived activities do not leave a broken start link. Activity completion does not automatically change recommendation status.

## Pages and API

`/dashboard` replaces the foundation placeholder with profile-based greetings, four summary cards, checklist progress, seven-day activity chart, compatible assessment series, active goals, recent events and current recommendations. `/progress` provides selected-range metrics, category selection, line/bar/donut charts, goal progress, paginated timeline and report download. `/admin/analytics` shows platform inventory and selected-period aggregate use.

All endpoints below are GET under `/api/v1`, require verified authentication and return the standard success/error envelope. Admin paths additionally require trusted ADMIN. Personal endpoints accept no target user ID.

| Prefix             | Paths                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `/dashboard`       | `/summary`, `/weekly-activity`, `/recommendations`, `/recent-activity`, `/goals`                                        |
| `/analytics`       | `/overview`, `/assessments`, `/activities`, `/activity-distribution`, `/goals`, `/streaks`, `/timeline`, `/report-data` |
| `/admin/analytics` | `/overview`, `/users`, `/assessments`, `/activities`, `/content`, `/engagement`                                         |

Additionally, `/analytics/dashboard` and `/admin/analytics/dashboard` return combined typed DTOs so one page does not issue eight overlapping aggregation requests. Individual analytics endpoints return `data: {period, data}`; assessments also includes paginated `history`. The combined personal DTO has `period`, `generatedAt`, `fullName`, `overview`, `daily`, `distribution`, `assessments`, `assessmentHistory`, `goals`, `streak`, and `timeline`. Report data adds current active recommendations. No answers/result snapshots are included.

Examples: `?range=7d`, `?range=30d&page=2&pageSize=20`, `?startDate=2026-10-01&endDate=2026-10-26`, and `?range=90d&category=EYE_COMFORT`. Do not mix presets and custom dates. Backend and frontend validate ranges with shared Zod; backend validates outgoing dashboard/analytics/report DTOs too. Missing migrations return actionable ANALYTICS_UNAVAILABLE / 503 errors.

## Admin privacy

Active users are distinct users who completed an assessment or wellness activity within the selected local range. Registrations, assessment usage, activity engagement and daily platform engagement use selected dates. Registered users, published/draft/archived article inventory and active activity definitions are current platform inventory, explicitly labeled separately.

No individual identities, health details, answers, assessment scores or private result snapshots are returned. A nonempty behavioral bucket needs at least five distinct contributors. Registration buckets need five registrations. If any nonempty bucket is below that threshold, its whole breakdown is suppressed (including zero buckets), reducing complementary inference. All linked behavioral panels and overview totals are suppressed together if any related breakdown is hidden. Static category lists prevent suppressed results from revealing which category had a small group. Suppressed values are null with suppressed=true, never fabricated zeros. Inventory counts are not sensitive behavioral buckets. This is threshold-based suppression, not differential privacy or a guarantee against inference across arbitrarily overlapping reports.

## Query synchronization and performance

TanStack Query remains the only API-state store. Central query keys include authenticated user ID and every result-changing filter: preset/custom dates, category, page and page size. Query roots support assessment/recommendation, activity/goal and profile/preference invalidation. Content changes refresh admin inventory. Notification read actions retain shared bell/history refreshes without needlessly refetching analytics. Existing AuthProvider cancels/clears queries on account changes/logout. No analytics data is copied into Zustand.

Chart pages and report generation are lazy-loaded. The report generator/font load only after export. One-minute query freshness allows dashboard/progress caching; active mutations invalidate affected roots. Database-side group/count queries avoid unbounded raw-session transfer and N+1 activity lookups. Existing Phase 4 screens retain their previous repository behavior; only new Phase 6 analytics uses the aggregated path.

## PDF export

Export requests authenticated `/analytics/report-data` using the applied reporting dates. The report includes all assessment categories for those dates; that behavior is labeled next to the controls. It does not derive values from chart DOM or stale browser state.

jsPDF creates branded A4 pages with consistent margins, wrapped sections, complete selected-range assessment summaries (not just the visible history page), daily/category activity totals, goal targets/percentages and up to five current recommendations. Long sections flow across pages and generation yields periodically. Every page has the educational/self-report disclaimer and page number. No report is saved at a public URL; the browser downloads `ScreenWise_Wellness_Report_YYYY-MM-DD.pdf`.

The bundled OFL Noto Sans font preserves its supported Unicode glyphs without stripping names. Its license is shipped alongside the asset. Complex-script shaping and characters outside the font's repertoire are a known limitation, not a claim of full multilingual PDF support. No chart raster images are used, avoiding mismatched chart ranges or external-image tracking. Vite pre-optimizes jsPDF during development to avoid a first-export dependency reload.

## Verification and remaining acceptance

Actual final command results are recorded in [development-progress.md](development-progress.md). Focused checks execute real migrations and SQL in isolated PostgreSQL (PGlite) for ownership, DST boundaries, compatibility groups, counts, pagination, goal parity and admin suppression. Browser checks use explicit test-only identity/HTTP fixtures around real components, download a real generated PDF, check mobile overflow, date filters, errors and role guards. These are bounded feature checks, not the Phase 7 campaign.

Hosted acceptance still requires the pending migrations, then real signed-in dashboard/assessment/activity/goal/report/admin round trips and two-user HTTP isolation. Current live readiness is not a passed acceptance check. Previous Phase 2 SMTP/recovery and native granted notification limitations remain. Phase 7 retains the formal cross-browser/accessibility/security/performance/UAT campaign; Phase 8 retains production deployment and operations.

## Integration follow-ups

App-wide form feedback now uses shared human-readable Zod defaults, accessible field-error components and actionable summaries. Network, timeout and Auth failures are normalized without displaying raw JSON. Onboarding validates/focuses each step and guards against completion-step resubmission. Native selects and Radix dropdowns have consistent icons/theme/sizing; desktop/mobile sidebar scroll areas and all scrollbars use thin themed styling. Shared-package watch mode now keeps compiled exports synchronized in root/app development commands.

Final local verification: strict typechecks, lint and builds passed; 17 local SQL/service checks passed; the full 13-case browser suite passed, followed by 4 focused cases including the added onboarding/sidebar/dropdown checks. Hosted readiness still requires missing 005 and new 008; see development-progress.md for exact evidence and limitations.
