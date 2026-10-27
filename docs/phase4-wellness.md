# Phase 4: prevention, goals, and reminders

Phase 4 extends the existing React/Express/Supabase monorepo. Health-library CRUD, analytics, PDF reports, and background push remain outside this phase.

## Apply migrations and seeds

Apply only unapplied migrations, once, in this order:

1. `supabase/migrations/202610160001_phase2_identity.sql`
2. `supabase/migrations/202610160002_private_avatars.sql`
3. `supabase/migrations/202610160003_phase3_assessments.sql`
4. `supabase/migrations/202610160004_phase4_wellness.sql`
5. `supabase/migrations/202610180005_phase4_integrity.sql`

Then run `supabase/seed-phase3.sql` and `supabase/seed-phase4.sql`, in that order. Use the Supabase SQL editor, running each complete file separately, or the normal migration workflow for an already-linked Supabase CLI project. Do not rerun create-table migrations. Seeds are idempotent; activity insertion preserves existing content by slug. Default linking fills empty activity links for matching recommendation types, so review the seed if administrators deliberately left a rule unlinked.

With PostgreSQL tools available and Phase 2 already installed, these PowerShell commands apply the remaining files:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610160003_phase3_assessments.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610160004_phase4_wellness.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610180005_phase4_integrity.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed-phase3.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed-phase4.sql
```

Configure `DATABASE_URL` privately for the intended development project. It is never a frontend variable. Both applications must use the same Supabase project; see [Supabase setup](supabase-setup.md). Restart `pnpm dev` after setup. Sixteen educational activities cover eye comfort, posture, movement, sleep habits, and device-free breaks. No completion records or fake users are seeded.

## Schema and ownership

Phase 4 adds `wellness_activities`, `activity_sessions`, `wellness_goals`, `goal_activity_links`, `reminder_settings`, `notifications`, and `daily_wellness_checklists`. It extends `user_preferences.timezone` and `recommendation_rules.activity_id`. Onboarding `user_wellness_goals` remain interests, not automatically activated measurable goals. No provisional `activity_logs`, `goals`, or `reminders` tables are duplicated.

Private tables have owner-select RLS; authenticated users read active activities and their own records but have no direct mutation grants. Verified Express services make owner-bound writes through server-only functions/client credentials. Admin activity routes require trusted database `ADMIN`. UUID foreign keys, unique/check constraints, indexes, and updated-at triggers enforce consistency. The integrity migration adds an active-activity category/duration index, JSON history constraints, minimum timer elapsed validation, and recommendation revision compatibility.

## Activity lifecycle

The integrity migration also stores an immutable `wellness_goals.archived_at` cutoff. Retrying an archive operation cannot move that cutoff forward or admit later completions into archived history.

Starting creates `STARTED` with a server timestamp, activity snapshot, and a UUID idempotency key unique per user. Retrying the same user/key/activity/source returns its session; a different payload conflicts. Completion/cancellation locks the owned row. Repeating the same final status is safe; changing a final status conflicts. Clients submit only status, never elapsed duration or completion timestamps.

The server computes elapsed seconds, capped at four hours. Completion after 24 hours is rejected; the old session can be cancelled. A timer-source session requires at least 20 seconds of server elapsed time. Guided activities require the last step and explicit confirmation, but completion is self-reported: timestamps do not prove exercise or sleep. Cancellation never counts as completed. Session snapshots survive later activity edits/archiving.

Checklist-source sessions are unique by user/activity/local start date unless cancelled. Only one active timer session per user is permitted. Intentionally starting another manual session can count again toward a goal. The checklist displays each completed activity once even when multiple saved sessions exist. Unfinished guided sessions can be cancelled from history after navigation; guided step position itself is not restored.

## Daily checklists and timezones

New plans are saved once per user/date/timezone, with activity snapshots. Plans use active goal links and onboarding interests with category defaults. Only today's plan can be created. Earlier dates show their saved plan or actual completed sessions and an explanation if no plan was recorded. Reviewing history never invents missed activities or backdates completions.

The checklist uses profile timezone, defaulting to `Asia/Kolkata`, editable at `/settings/reminders`. Completion belongs to the local day of its server completion timestamp. Changing timezone does not rewrite previous plans. Goals and reminders retain their own explicitly saved IANA timezone. UTC `timestamptz` storage plus local-date formatting handles DST boundaries. Activity history labels its device-timezone timestamp display.

## Eye-break timer

Zustand holds the client clock, account/activity/session identifiers, and interval. PostgreSQL holds persisted sessions separately. Remaining time comes from a deadline timestamp, not a decrement-only counter. A workspace coordinator ticks across navigation and checks visibility changes. Focus completion shows a prompt linking back to the timer; a finished break requires explicit confirmation before a completion API call.

Start/pause/resume/reset, focus-ready, break, and confirmation phases are supported. Default focus interval is 20 minutes, configurable from 5–120. Validated tab-scoped sessionStorage state restores paused with its last saved remaining time, so closed-browser time is not credited as screen activity. Sign-out/account changes clear the previous account's timer. The countdown is not a screen-usage sensor. Backend timer records can be shared across tabs; client focus clocks are tab-scoped rather than cross-tab synchronized.

## Goals, progress, and streaks

Users create/edit daily or weekly goals, choose associated published activities, pause/resume, and archive. Category must match linked activities, except `GENERAL`, which can combine categories. Onboarding interests only suggest prefills; saving is explicit.

Backend progress counts real `COMPLETED` linked-activity sessions in the goal's local date range and current period. Exclude paused days, dates before `max(start_date, tracking_start)`, dates after end date, and sessions after an archive timestamp. Percentage is rounded `count / target_count * 100`, capped at 100; actual count remains visible. A chosen historical start date can count existing sessions. Weeks run Monday–Sunday in the goal timezone.

Daily target attainment extends a streak. A missed finished day resets it; an unfinished current day does not break yesterday's streak. Paused days reset streaks and do not count. The resume day remains excluded, with counting resuming the following day. Weekly streaks count weeks; any paused day excludes that week from streak eligibility. Ended, paused, or archived goals have zero current active streak. Longest streak derives from eligible tracked history. Archiving freezes history at the archive timestamp.

Changing target/period/category/timezone/dates/activity associations saves the old definition and links in `definition_history` and starts a new segment from the later of today and the new start date. Title/description edits preserve tracking. Old definitions remain stored; the UI does not replay their old progress formulas. Activity history is preserved.

## Reminders and notifications

Each user can save one schedule per eye-break, posture, movement, daily-goal, or evening-routine type. Intervals are 5–240 minutes, with evening routines once per active day. Active hours must have end after start on the same day; overnight schedules are rejected. Distinct weekdays and a valid IANA timezone are required. Global delivery and individual schedule enablement must both be on.

The visible workspace polls `POST /reminders/poll` every 30 seconds and on visibility restoration. The backend computes the current local slot and transactionally rechecks ownership/enablement before inserting unique user/reminder/date/slot notifications. Concurrent tabs receive only newly inserted records; repeated DST wall-clock slots share a key. Missed slots are not replayed, but reopening during an active slot may produce its current reminder. Failures retry on later polls; settings/history show request errors.

Saved in-app notifications and toasts work without browser permission. Browser support is checked; permission is requested only from the explicit settings button. Granted permission enables best-effort browser delivery for newly generated reminders. Denial shows browser-settings guidance. Disabling reminders stops new generation and preserves history. The bell shows unread counts/recent notifications, while `/notifications` supports filtering and individual/all read actions.

No closed-tab/browser delivery is guaranteed. No service worker, background scheduler, push subscription, or catch-up queue is introduced. Persistent web push remains a future enhancement.

## Phase 3 integration

Recommendations link to real activities; defaults are seeded and administrators can edit links at `/admin/recommendations`. Activity completion invalidates wellness/goal/checklist caches but never automatically completes/dismisses a recommendation. Status changes stay explicit at `/wellness-plan`.

Link-only rule edits preserve revision so completed/dismissed recommendations are not reissued. Content/condition/status edits still increment it. A pre-existing Phase 3 defect was corrected: evaluation validates `conditions` separately instead of passing database metadata through a strict request schema. Existing assessment/scoring/recommendation modules were reused.

## Routes and verification

Permission UI checks include the browser's native denied state and a test-only Notification API fixture for an explicit default-to-granted request. Native granted notification delivery could not be verified under the headless browser policy.

Frontend routes: `/prevention`, `/prevention/:activityId`, `/prevention/daily-checklist`, `/prevention/history`, `/goals`, `/settings/reminders`, `/notifications`, `/admin/activities`. Existing `/wellness-plan` and `/admin/recommendations` integrate activities. Pages use existing auth/onboarding/admin guards, responsive layouts, feature query hooks, Axios clients, loading/error/empty states, and accessible controls. See [API contracts](api.md#phase-4-implemented-endpoints).

On 2026-10-18, `pnpm test` passed 11 tests; `pnpm test:e2e` passed 7 Chromium tests; strict typechecking, lint, and production builds passed. Local PGlite tests execute real migrations/seeds with minimal test Auth/Storage scaffolding and cover ownership, idempotency, transaction rollback, timers, timezones, goal history, and reminders. Browser tests cover unauthenticated guards plus real components under explicitly intercepted test-only identity/HTTP fixtures. Those fixtures are not production APIs and do not prove hosted persistence.

Read-only hosted checks found `profiles` available, but Phase 3 and Phase 4 tables returned `PGRST205`. API credentials exist; a direct database connection is not configured. No hosted migrations or seed writes occurred. Published activities, live assessment submission, real completions/goals/reminders, two-user RLS, and trusted-admin HTTP round trips require acceptance after migration. No secrets or personal data were printed.

Known limitations include upstream Zod annotation/build chunk warnings, a large initial JS bundle, single-process API rate limiting, no background push, no old-definition formula replay, and pending cross-browser/accessibility audits. Phase 5 health-library/content work can start after schema setup and signed-in acceptance. Phase 6 analytics/PDF work remains out of scope.
