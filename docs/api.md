<!-- Phase 3 extension: see docs/assessment-scoring.md and development-progress.md for verified status. -->

# REST API contracts

## Phase 5 implemented endpoints

All paths use `/api/v1` and require a verified confirmed Supabase Bearer identity, matching existing library route access. Admin routes require the trusted database `ADMIN` role. Reader APIs always enforce `PUBLISHED` status and active category, including for admin callers. No frontend-supplied role/owner/author/reading-time/status is authoritative.

| Method | Path                            | Contract                                                                                                              |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET    | `/articles`                     | Paginated articles; `search`, `categoryId`, `tagId`, `sort=newest                                                     | oldest`, `featured=true | false`, `page`, `pageSize`                 |
| GET    | `/articles/categories`          | Active categories ordered by display order/name                                                                       |
| GET    | `/articles/tags`                | Available tags                                                                                                        |
| GET    | `/articles/:slug`               | Published article, sources, category/tags, generated reading time, cover URL and caller bookmark state                |
| GET    | `/articles/:slug/related`       | Up to three published related articles, category then tag then recent fallback                                        |
| GET    | `/bookmarks`                    | Owner links with nested article, or `article:null` when no longer published/available                                 |
| POST   | `/bookmarks`                    | `{articleId:UUID}`; idempotent add, HTTP 201                                                                          |
| DELETE | `/bookmarks/:articleId`         | Idempotent owner removal                                                                                              |
| GET    | `/admin/articles`               | Full content list; reader filters plus `status=DRAFT                                                                  | PUBLISHED               | ARCHIVED`; admin ordering uses update time |
| POST   | `/admin/articles`               | Full validated definition; creates a draft, HTTP 201                                                                  |
| GET    | `/admin/articles/:id`           | Admin article detail/preview, including drafts                                                                        |
| PATCH  | `/admin/articles/:id`           | Full definition plus expected `revision`; stale/archived conflicts return 409                                         |
| POST   | `/admin/articles/:id/publish`   | `{revision}`; validates review, references, content and active category                                               |
| POST   | `/admin/articles/:id/unpublish` | `{revision}`; moves to draft, including restoration from archive                                                      |
| POST   | `/admin/articles/:id/archive`   | `{revision}`; soft archive, retaining associations and saved links                                                    |
| GET    | `/admin/categories`             | Active and inactive categories                                                                                        |
| POST   | `/admin/categories`             | Full category definition, HTTP 201                                                                                    |
| PATCH  | `/admin/categories/:id`         | Full category definition; supports activation and ordering                                                            |
| DELETE | `/admin/categories/:id`         | Safe deactivation, never deletion of referenced content                                                               |
| GET    | `/admin/tags`                   | Tag metadata                                                                                                          |
| POST   | `/admin/tags`                   | `{name,slug}`, HTTP 201                                                                                               |
| PATCH  | `/admin/tags/:id`               | `{name,slug}`                                                                                                         |
| DELETE | `/admin/tags/:id`               | Deletes only unused tags; linked tags return 409                                                                      |
| GET    | `/admin/media`                  | Paginated registered images and readiness state                                                                       |
| POST   | `/admin/media/upload`           | Multipart `file`; one JPEG/PNG/WebP up to 5 MB; validates/re-encodes actual bytes; HTTP 201                           |
| DELETE | `/admin/media/:id`              | Safe UUID resource ID; reserves and removes only unused media                                                         |
| GET    | `/admin/content/summary`        | `{totalArticles,publishedArticles,draftArticles,categories,activeActivities,activeRules}` from actual database counts |

Article input: `{title,slug,summary,category_id,content,cover_image_path:null|controlledPath,tag_ids:UUID[],sources:[{title,source_url,publisher:null|string}],is_featured,editorial_reviewed,revision?}`. `content` is allowlisted TipTap JSON, not HTML. Revision is required on updates. New article author/time/status/word count/reading time are server-owned. Source/link URLs must be HTTPS; inline image URLs must match registered media in the project's bucket. Publishing requires a nonempty summary/body, active category, sources and explicit editorial review. Unsupported/forged fields fail strict validation.

Category input: `{name,slug,description:null|string,icon:null|string,display_order:0..9999,is_active}`. Media returns `{id,path,url,status,created_at,...}`; database references store controlled paths rather than base64 content. Upload MIME, bytes, dimensions and count are checked. Files are normalized to WebP. Images are public by URL, including draft media, as the editor explains.

Lists use `{success:true,data:[],meta:{page,pageSize,total,totalPages}}`, default page 1/12 and maximum pageSize 100. Metadata arrays, detail/summary and mutations use `{success:true,data:...}`. Errors use the existing envelope: validation 400, missing identity 401, non-admin 403, missing/unavailable article 404, duplicate/conflict/in-use 409, oversized upload 413, unavailable schema/Storage 503. Static routes are registered before dynamic slugs/IDs. Image upload rate limit is 10/minute per verified administrator.

`GET /admin/recommendations` additionally accepts `activityId` for the existing activity-linked rule view. All Phase 3 rule conditions, priorities, create/edit/activation and Phase 4 activity forms remain reused. Apply [Phase 5 conflict patch](phase5-library.md#conflict-patch) for database race handling with explicit `PT409`; backend prechecks avoid the known deterministic retry timeout on the previously installed functions.

## Phase 4 implemented endpoints

All paths below use `/api/v1`, confirmed Bearer authentication, verified owner IDs, strict shared Zod mutation schemas, and the existing success/error envelope. Global activity writes additionally require the trusted `ADMIN` role. Body/database DTO fields are snake_case except the session `idempotencyKey`. The provisional Phase 1 contracts later in this document do not describe these implemented routes.

| Method | Route                             | Input / behavior                                                                             |
| ------ | --------------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/activities`                     | Active activities; `page`, `pageSize`, `search`, `category`, `difficulty`, `maxDuration`     |
| GET    | `/activities/history`             | Owner sessions; `page`, `pageSize`, `status`                                                 |
| GET    | `/activities/today`               | Saved daily checklist, actual completions and goals; optional ISO `date` and IANA `timezone` |
| GET    | `/activities/:id`                 | Active activity details/instructions                                                         |
| POST   | `/activities/:id/sessions`        | `{idempotencyKey,source?:MANUAL\|CHECKLIST\|TIMER}`; returns session, HTTP 201               |
| PATCH  | `/activities/sessions/:sessionId` | `{status:COMPLETED\|CANCELLED}`; idempotent finalization, server-owned time/duration         |
| GET    | `/goals`                          | Owner goals with backend progress; `page`, `pageSize`, `status`                              |
| GET    | `/goals/summary`                  | Goals with progress plus preserved onboarding interests                                      |
| POST   | `/goals`                          | Full goal definition; returns created goal, HTTP 201                                         |
| GET    | `/goals/:id`                      | Owned goal plus progress                                                                     |
| GET    | `/goals/:id/progress`             | Count/target/percentage, local period, current/longest streak, period history                |
| PATCH  | `/goals/:id`                      | Full goal definition or `{status:ACTIVE\|PAUSED\|ARCHIVED}`                                  |
| DELETE | `/goals/:id`                      | Archive; retains sessions/history and returns the archived goal                              |
| GET    | `/reminders`                      | Owner schedules                                                                              |
| POST   | `/reminders`                      | Full reminder definition; returns created schedule, HTTP 201                                 |
| PATCH  | `/reminders/:id`                  | Full reminder definition, owner-bound                                                        |
| DELETE | `/reminders/:id`                  | Remove schedule; returns `{id,deleted:true}`                                                 |
| POST   | `/reminders/poll`                 | Generate current enabled slots once; returns only newly inserted notifications               |
| GET    | `/notifications`                  | Owner history; `page`, `pageSize`, `unread=true`                                             |
| GET    | `/notifications/unread-count`     | `{count}`                                                                                    |
| PATCH  | `/notifications/:id/read`         | Empty body; mark owned record read                                                           |
| POST   | `/notifications/read-all`         | Mark owner's unread records read; `{updated}`                                                |
| GET    | `/admin/activities`               | Paginated full activity definitions, including inactive                                      |
| POST   | `/admin/activities`               | Full activity definition; HTTP 201                                                           |
| PATCH  | `/admin/activities/:id`           | Full activity definition                                                                     |
| DELETE | `/admin/activities/:id`           | Soft archive (`is_active=false`), retaining history                                          |

List responses use `{success:true,data:[],meta:{page,pageSize,total,totalPages}}`. Schedules, summaries and individual records use `{success:true,data:...}`. Lists default to page 1/20, maximum pageSize 100. Static history/today/summary/unread routes are registered before dynamic identifiers. Validation returns 400, owner/missing-record failures 404, conflicts 409, and unavailable schema 503. Auth middleware rejects missing/invalid tokens and unauthorized admins.

Activity definition: `{title,slug,description,category,duration_seconds,instructions:string[],benefits:string[],safety_notes:string|null,icon:string|null,image_url:httpsURL|null,difficulty:EASY|MODERATE,is_active}`. Categories: `EYE_COMFORT`, `POSTURE`, `MOVEMENT`, `SLEEP`, `DIGITAL_BREAK`, `GENERAL`.

Goal definition: `{title,description:string|null,category,target_count:1..100,period:DAILY|WEEKLY,start_date:YYYY-MM-DD,end_date:date|null,timezone,activity_ids:UUID[]}`. At least one distinct active linked activity is required. Edits retain old measurement definitions. Streak rules and archive behavior are in [Phase 4 wellness](phase4-wellness.md).

Reminder definition: `{reminder_type:EYE_BREAK|POSTURE|MOVEMENT|DAILY_GOAL|EVENING_ROUTINE,interval_minutes:5..240|null,enabled,start_time:HH:mm,end_time:HH:mm,days_of_week:0..6[],timezone}`. Interval is required except for evening routines; weekdays must be distinct and nonempty. Hours must stay within one day with end after start. `PATCH /users/preferences` additionally accepts `{timezone}` for checklist day boundaries and `{notifications_enabled}` for global delivery.

Existing `/admin/recommendations` create/update definitions now accept optional `activity_id:UUID|null`; links must reference an active activity. Link-only edits preserve rule revision/status. `/recommendations/me` exposes linked IDs for starting related activities; completing an activity never automatically changes recommendation status.

Base: http://localhost:4000/api/v1. JSON envelope: `{success:true,data:T}` or `{success:false,error:{code,message,details?}}`. Phase 2 account DTOs use **snake_case**, matching the shared schemas; this supersedes Phase 1's proposed camelCase account fields.

## Implemented endpoints

All user endpoints require a confirmed Supabase identity and Bearer access token. They derive the owner from verified identity; no owner ID is accepted from the request. Unknown/forbidden JSON fields are rejected.

| Method | Route                 | Input                                                             | Response data                                               |
| ------ | --------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| GET    | /health               | Public, none                                                      | {status:"ok",service:"screenwise-api"}; process health only |
| GET    | /users/me             | Bearer                                                            | UserProfile                                                 |
| PATCH  | /users/me             | {full_name?,occupation?}; at least one                            | Updated UserProfile                                         |
| GET    | /users/preferences    | Bearer                                                            | UserPreferences                                             |
| PATCH  | /users/preferences    | Any nonempty subset of preference fields below                    | Updated UserPreferences                                     |
| GET    | /users/onboarding     | Bearer                                                            | {profile,preferences,goals}                                 |
| POST   | /users/onboarding     | Full onboarding schema below                                      | Persisted {profile,preferences,goals}; atomic completion    |
| GET    | /users/wellness-goals | Bearer                                                            | GoalKey[]                                                   |
| PUT    | /users/wellness-goals | {goals:GoalKey[]}; unique, at most six                            | Persisted GoalKey[]; atomic replacement                     |
| POST   | /users/avatar         | multipart/form-data; one field named avatar; PNG/JPEG/WebP <=2 MB | Updated UserProfile with signed avatar URL                  |
| GET    | /admin/access         | Bearer + database ADMIN role                                      | {authorized:true}                                           |

UserProfile includes id, full_name, email, role, avatar_url, occupation, onboarding_completed, created_at and updated_at. Avatar URL is a one-hour signed private URL or null. No profile PATCH accepts role, email, avatar_url, id or onboarding_completed.

Preference fields: age_range, primary_device, daily_screen_hours (0-24), usage_purpose, sleep_time/wake_time (HH:mm or HH:mm:ss), break_frequency, theme (light/dark/system), notifications_enabled (boolean). Habit fields may be null. IDs/owner/timestamps cannot be patched. Returned preferences include id, user_id and timestamps.

Onboarding requires full_name (2-100 characters), occupation, primary_device, daily_screen_hours, usage_purpose, break_frequency, goals (at least one), and nullable age_range/sleep_time/wake_time. Allowed enums are in @screenwise/shared schemas/users.ts. Goal keys: eye_comfort, posture, sleep, screen_breaks, digital_fatigue, overall_wellness.

## Authentication and errors

The frontend calls Supabase Auth directly for signup/password login/recovery/change-password/logout. Express does not store passwords or mint tokens. Each API token is verified by auth.getUser; admin authority is read from profiles.role. Public navigation guards are convenience only, not backend security.

Statuses: 400 validation/malformed JSON/invalid image; 401 missing/invalid/expired session; 403 unconfirmed email or wrong role; 404 missing route; 413 upload or JSON body too large; 429 rate limit; 503 missing Supabase configuration/database/Storage unavailable; 500 unexpected error. Database details are not returned. The current JSON limit is 100 KB; multipart avatar limit is 2 MB. Example:

```json
{
  "success": false,
  "error": { "code": "UNAUTHENTICATED", "message": "Sign in to continue." }
}
```

Account endpoints are single resources and do not use pagination. Future lists use page/pageSize (1/20 defaults, max pageSize 100) with `meta:{page,pageSize,total,totalPages}`. CORS is restricted to FRONTEND_URL. API rate limits are documented in architecture.md; Supabase Auth has its own provider limits. No Phase 3 API is implemented.

## Future domain API reference (not implemented)

The retained Phase 1 contracts below are planning only and may be refined when their phase begins. Current account APIs above take precedence. Routes listed below return 404 unless explicitly implemented above.

Auth labels: **User** = verified identity with owner checks; **Admin** = verified privileged role; **Public** = no identity needed. Shapes use the named resources below.

| Method | Route                                          | Auth   | Request body/query                                          | Response data                                                          |
| ------ | ---------------------------------------------- | ------ | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| GET    | /assessment-types                              | User   | page/pageSize, category?                                    | AssessmentType[] + meta                                                |
| GET    | /assessment-types/:id                          | User   | —                                                           | Type + published version/questions/options; excludes scoring internals |
| POST   | /assessment-attempts                           | User   | `{assessmentTypeId}`                                        | Attempt, pinned to currently published version                         |
| GET    | /assessment-attempts                           | User   | page/pageSize                                               | Attempt[] + meta                                                       |
| GET    | /assessment-attempts/:id                       | User   | —                                                           | Attempt + own responses/result                                         |
| PUT    | /assessment-attempts/:id/responses/:questionId | User   | Exactly one `{optionId}` / `{numericValue}` / `{textValue}` | AssessmentResponse; in-progress only                                   |
| POST   | /assessment-attempts/:id/submit                | User   | `{}`                                                        | Attempt with server-calculated result; no client score                 |
| GET    | /recommendations                               | User   | page/pageSize, status?                                      | UserRecommendation[] + meta                                            |
| PATCH  | /recommendations/:id                           | User   | `{status}`                                                  | UserRecommendation                                                     |
| GET    | /activities                                    | Public | page/pageSize, category?                                    | Published Activity[] + meta                                            |
| GET    | /activities/:id                                | Public | —                                                           | Published Activity                                                     |
| POST   | /activity-logs                                 | User   | `{activityId,completedAt,durationSeconds,notes?}`           | ActivityLog                                                            |
| GET    | /activity-logs                                 | User   | page/pageSize, from?, to?                                   | ActivityLog[] + meta                                                   |
| DELETE | /activity-logs/:id                             | User   | —                                                           | `{id,deleted:true}`                                                    |
| GET    | /goals                                         | User   | page/pageSize, status?                                      | Goal[] + meta                                                          |
| POST   | /goals                                         | User   | `{title,metric,target,startDate,endDate}`                   | Goal                                                                   |
| PATCH  | /goals/:id                                     | User   | Partial goal editable fields/status                         | Goal                                                                   |
| DELETE | /goals/:id                                     | User   | —                                                           | `{id,deleted:true}`                                                    |
| GET    | /categories                                    | Public | page/pageSize                                               | Category[] + meta                                                      |
| GET    | /articles                                      | Public | page/pageSize, category?, q?                                | Published ArticleSummary[] + meta                                      |
| GET    | /articles/:slug                                | Public | —                                                           | Published Article                                                      |
| GET    | /bookmarks                                     | User   | page/pageSize                                               | Bookmarked ArticleSummary[] + meta                                     |
| PUT    | /bookmarks/:articleId                          | User   | `{}`                                                        | `{articleId,createdAt}`; idempotent                                    |
| DELETE | /bookmarks/:articleId                          | User   | —                                                           | `{id,deleted:true}`                                                    |
| GET    | /reminders                                     | User   | page/pageSize                                               | Reminder[] + meta                                                      |
| POST   | /reminders                                     | User   | `{label,schedule,timezone,goalId?,activityId?,enabled}`     | Reminder                                                               |
| PATCH  | /reminders/:id                                 | User   | Partial editable reminder                                   | Reminder                                                               |
| DELETE | /reminders/:id                                 | User   | —                                                           | `{id,deleted:true}`                                                    |
| GET    | /notifications                                 | User   | page/pageSize, unread?                                      | Notification[] + meta                                                  |
| PATCH  | /notifications/:id                             | User   | `{read:true}`                                               | Notification; server sets readAt                                       |
| GET    | /progress                                      | User   | from/to dates, max range to be bounded                      | `{activityTotals,assessmentTrends,goalProgress}` from real records     |

Authentication signup/login/password reset/session refresh will use the official Supabase Auth client in Phase 2. There are no Express password-storage or token-minting endpoints planned. Auth state and protected routes must only be added with actual token verification.

## Planned administration

All routes require Admin; paginated GET lists use the common envelope. Administrative content DTOs include draft state; public DTOs do not expose drafts or rule criteria. Content writes validate full domain schemas. Role assignment, account suspension, and access to individual health records are not implied by these routes.

| Methods       | Route                                  | Input                                                                      | Response data                                                        |
| ------------- | -------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| GET           | /admin/overview                        | —                                                                          | Aggregate platform counts; no personal health records                |
| GET           | /admin/users                           | page/pageSize, q?                                                          | Minimized `{id,displayName,role,createdAt}[]` + meta                 |
| GET, POST     | /admin/assessment-types                | list query / `{slug,name,category,description}`                            | Type[] + meta / Type (201)                                           |
| PATCH         | /admin/assessment-types/:id            | Partial descriptive fields or archived state                               | Type                                                                 |
| POST          | /admin/assessment-types/:id/versions   | `{questions:[{prompt,responseKind,position,options:[]}],scoringConfig}`    | Draft Version (201)                                                  |
| PATCH         | /admin/assessment-versions/:id         | Validated draft definition only                                            | Version; 409 if published                                            |
| POST          | /admin/assessment-versions/:id/publish | `{}`                                                                       | Version; atomic publication                                          |
| GET, POST     | /admin/articles                        | list query / `{slug,title,summary,body,categoryId,status,coverPath?}`      | Article[] + meta / Article (201)                                     |
| PATCH, DELETE | /admin/articles/:id                    | Partial article / —                                                        | Article / delete envelope                                            |
| GET, POST     | /admin/activities                      | list query / `{slug,title,instructions,categoryId,durationSeconds,status}` | Activity[] + meta / Activity (201)                                   |
| PATCH, DELETE | /admin/activities/:id                  | Partial activity / —                                                       | Activity / delete envelope; 409 if referenced, archive instead       |
| GET, POST     | /admin/recommendation-rules            | list query / `{versionId,ruleKey,criteria,title,body,activityId?}`         | Rule[] + meta / new revision (201)                                   |
| PATCH         | /admin/recommendation-rules/:id        | `{active}`                                                                 | Rule; content changes create new revision                            |
| GET           | /admin/analytics                       | from/to bounded range                                                      | Aggregate usage metrics with minimum cohort thresholds to be defined |

## Resource shapes

All resources use camelCase in JSON and snake_case in PostgreSQL, mapped by future services. Each includes `id,createdAt` except Preferences (userId) and Bookmarks (articleId). Mutable resources include updatedAt.

- Profile: `{id,displayName,role,avatarPath?}`. Preferences: `{userId,timezone,theme,remindersEnabled}`.
- AssessmentType: `{id,slug,name,category,description}`. Version: `{id,assessmentTypeId,version,status,questions}`. Question: `{id,prompt,responseKind,required,position,options:[{id,label,position}]}`.
- Attempt: `{id,versionId,status,startedAt,submittedAt?,result?:{score,summary}}`. AssessmentResponse: `{id,attemptId,questionId,optionId?|numericValue?|textValue?}`.
- UserRecommendation: `{id,attemptId,title,body,activityId?,status}` from stored snapshot. Rule: `{id,versionId,ruleKey,revision,criteria,title,body,activityId?,active}`.
- Activity: `{id,slug,title,instructions,categoryId,durationSeconds}`. ActivityLog: `{id,activityId,completedAt,durationSeconds,notes?}`.
- Goal: `{id,title,metric,target,startDate,endDate,status}`. Category: `{id,slug,name,description?}`.
- ArticleSummary: `{id,slug,title,summary,categoryId,publishedAt,coverPath?}`; Article adds sanitized `body`.
- Reminder: `{id,label,schedule:{frequency,time,daysOfWeek?},timezone,enabled,nextRunAt?,goalId?,activityId?}`. Schedule requires DST/recurrence validation before implementation.
- Notification: `{id,kind,title,body,createdAt,readAt?}`.

These contracts are design targets, not generated client claims. Future phases must add endpoint tests, OpenAPI, versioned schemas, authorization, rate limits, and database transaction/RLS tests before exposing them.

## Phase 3 implemented endpoints

All require verified authentication; /admin/* additionally requires database ADMIN. User routes: GET /assessments (search/category/page/pageSize), GET /assessments/:id, POST /assessments/:id/submit ({assessmentVersionId,idempotencyKey,responses:[{questionId,selectedOptionId}]}), GET /assessments/history (assessmentId/from/to UTC/page/pageSize), GET /assessments/attempts/:attemptId, GET /assessments/:id/trends, GET /recommendations/me (status/page/pageSize), PATCH /recommendations/:id ({status}), POST /recommendations/refresh. Lists use the standard data/meta envelope. Trends return separate compatibility groups. Admin: GET/POST /admin/assessments, GET/PATCH /admin/assessments/:id (metadata), POST /:id/drafts, PUT /:id/draft ({revision,scoring_config,questions}), POST /:id/questions, PATCH /:id/questions/:questionId (full question including options), POST /:id/publish ({revision}), POST /:id/archive; paths are under /admin/assessments. Full draft arrays determine question/option order. GET/POST /admin/recommendations, PATCH /admin/recommendations/:id (full rule fields), DELETE /admin/recommendations/:id (deactivate). Safe conditions use {mode:all|any,conditions:[{field:category|score|feedback|answer|goal,...}]}; see shared schemas. Conflicts return 409, validation 400, ownership misses 404, missing schema 503. New resources/submissions return 201. No client score is accepted.

## Phase 6 dashboard and analytics APIs

All paths below are GET under `/api/v1` with verified Supabase authentication. `/admin/analytics/*` additionally requires trusted database ADMIN; the RPC repeats its role check. Personal queries always bind the verified owner and never accept a target user ID. Success/error envelopes remain standard. Missing schema/connectivity returns actionable `ANALYTICS_UNAVAILABLE` / 503.

- Dashboard: `/dashboard/summary`, `/dashboard/weekly-activity`, `/dashboard/recommendations`, `/dashboard/recent-activity`, `/dashboard/goals`.
- Personal analytics: `/analytics/overview`, `/analytics/assessments`, `/analytics/activities`, `/analytics/activity-distribution`, `/analytics/goals`, `/analytics/streaks`, `/analytics/timeline`, `/analytics/report-data`.
- Admin analytics: `/admin/analytics/overview`, `/admin/analytics/users`, `/admin/analytics/assessments`, `/admin/analytics/activities`, `/admin/analytics/content`, `/admin/analytics/engagement`.
- Combined page DTOs: `/analytics/dashboard` and `/admin/analytics/dashboard`, reducing repeated overlapping aggregation requests.

Filters: `range=7d|30d|90d` (default 30d, including local today), or both `startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (inclusive, ordered, at most 366 days, no future dates). Saved preference timezone controls general reporting boundaries. Optional assessment `category`, plus `page` and `pageSize` (1–100) for detailed histories. Category selection affects only assessment series/history. Query keys include every filter. Individual analytics responses contain `{period,data}` inside the standard success envelope; `/assessments` also includes paginated `history`. Combined DTOs are defined/validated in shared analytics schemas. Report data includes all selected-range assessment series plus up to five current active recommendations, independently of the visible history page.

Inventory totals are current; behavioral admin metrics follow selected dates. Active user means a distinct user completing an assessment or activity in the range. Admin DTOs contain aggregate counts only, with null/suppressed markers for small groups. User DTOs contain minimized score summaries, session timeline entries and goal progress; no answers or result snapshots. Reports are generated in-browser, without public report URLs. See [Phase 6 guide](phase6-analytics.md) for exact goal-period, streak, snapshot and privacy semantics.
