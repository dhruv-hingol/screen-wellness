# Phase 5: health library and content management

Phase 5 extends the existing monorepo with database-backed library reading, search, bookmarks, a TipTap editor, media uploads, taxonomy management, and an admin content overview. Existing assessments, activities, goals, reminders, and recommendations are reused. No Phase 6 analytics, PDF exports, project recreation, or Git initialization is included.

## Current hosted state and safe migration order

Read-only checks on 2026-10-18 found Phase 3 and Phase 4 core tables present. The Phase 5 tables and `article-media` bucket appeared during implementation and were then exercised through live APIs. The agent did not execute hosted SQL migrations or reset existing tables. The Phase 4 `wellness_goals.archived_at` column remains missing, and the Phase 5 conflict marker is not yet installed.

For this observed hosted project, review migration history and run only the pending patches in the SQL editor, each complete file separately:

1. `supabase/migrations/202610180005_phase4_integrity.sql` — if not already applied; the missing `archived_at` column indicates this migration is incomplete or pending. If it was partially applied manually, inspect its existing indexes/functions before continuing rather than rerunning it blindly.
2. `supabase/migrations/202610180007_phase5_conflicts.sql` — applies safely after the already-present Phase 5 schema. It replaces only the conflict SQLSTATE in three existing functions and adds a service-only readiness marker. It preserves table data and function privileges.

**Do not rerun `202610180006_phase5_library.sql` on this project: its tables already exist.** For a fresh development database, apply unapplied migration files in filename order: `001`, `002`, `003`, `004`, `005`, `006`, `007`, then the relevant seeds. `006` creates the library tables, transaction functions, grants, RLS, and media bucket configuration. `007` is required even when installing the current `006`, because it changes business conflicts into explicit HTTP conflicts.

With a configured PostgreSQL connection, the equivalent commands for the observed project are:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610180005_phase4_integrity.sql
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202610180007_phase5_conflicts.sql
```

Use a privately configured development database URL. API service keys are not SQL connection strings. No direct database connection is currently configured in the workspace, so these SQL patches were not remotely applied by the agent.

Check readiness without exposing credentials or user rows:

```powershell
pnpm db:check-content
```

The command reports only table/column status, the conflict marker, and bucket settings. It exits nonzero when dependencies remain incomplete. It does not apply or infer the full migration history. Historical Phase 4 notes about missing core tables reflect the earlier state, not the current probe.

## Seed data

`supabase/seed-phase5.sql` contains six categories, six tags, and twelve original educational articles. It calculates reading time, assigns relevant sources/tags, and inserts published content with realistic timestamps. Repeating the SQL seed preserves administrator edits: existing category/tag/article IDs or slugs are not overwritten, and tags are linked only for newly inserted articles. The SQL seed runs in one transaction.

The agent populated the currently installed schema using the optional REST seeder because no SQL connection is configured:

```powershell
pnpm build
pnpm db:seed-library --run
```

The REST seeder reads definitions from the versioned SQL file, validates rich text using the same shared/backend code, and writes through the server-only Supabase client. It is not a separate set of hardcoded application content. It inserts only missing definitions, preserves edits, and attempts cleanup of its own newly inserted rows if a step fails. SQL remains the preferred fully transactional setup path. It needs compiled shared/API packages, so build first. Never put its privileged key into a Vite variable.

The first hosted REST run inserted **6 categories, 6 tags, 12 published articles**. A second run inserted **0/0/0**, confirming repeatability. These permanent educational seeds are separate from disposable acceptance-test data, which was removed. No fake completions, assessment answers, users, or endorsements are seeded.

Referenced background resources were checked during preparation: [OSHA workstation overview](https://www.osha.gov/computer-workstations), [OSHA evaluation checklist](https://www.osha.gov/etools/computer-workstations/checklists/evaluation), [CDC About Sleep](https://www.cdc.gov/sleep/about/), [WHO physical activity](https://www.who.int/news-room/fact-sheets/detail/physical-activity), and [NHS wellbeing resources](https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/). The articles contain original planning/reflection exercises with modest educational language. These sources do not endorse ScreenWise, and seed review is not a claim of clinical validation or a professional medical review.

## Schema and authorization

Seven new tables are introduced:

| Table                 | Purpose                                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `article_categories`  | Ordered, active/inactive categories with unique slugs.                                                                |
| `articles`            | Rich JSON, summary, category, author snapshot, status, revision, sources, reading metrics, cover path and timestamps. |
| `article_tags`        | Unique names/slugs.                                                                                                   |
| `article_tag_links`   | Composite unique article/tag associations.                                                                            |
| `bookmarks`           | Owner-only saved links, unique `(user_id, article_id)`.                                                               |
| `article_media`       | Server-generated image paths, uploader and deletion state.                                                            |
| `article_media_links` | Tracks cover/inline references so used images cannot be deleted.                                                      |

Foreign keys, indexes, update/revision triggers and constraints preserve relationships. Article sources are a validated JSON array on each article, avoiding an unnecessary extra sources table. Author names are snapshots from the verified editor; user emails are never joined into reader responses. Deleting an author account clears its ID and retains the article attribution snapshot.

All tables have RLS. Authenticated readers can see published articles in active categories, active categories, and taxonomy. Trusted database admins can inspect drafts through admin APIs and admin read policies. Article/category/tag/media writes require authenticated admin backend routes; there are no direct browser write grants. Transaction functions independently verify the trusted editor role. Ordinary library APIs force published/active filters even when called by an admin.

Bookmarks allow only owner reads/inserts/deletes; insertion requires a currently published article in an active category. The server derives ownership from the verified token. Repeating an add reuses the existing bookmark; removal is idempotent. If an article is unpublished, archived, or hidden by an inactive category, its saved link remains as an unavailable item without leaking its title/content, and can still be removed.

## Article lifecycle and rich text

New articles are `DRAFT`. Editing uses an expected revision; concurrent/stale writes return 409. Publishing requires a nonempty title/summary/content, an active category, at least one valid HTTPS reference, and explicit editorial confirmation. Reading metrics are calculated on the backend. Unpublishing moves an article to `DRAFT`; archiving retains its content, bookmarks, tags and media references. Archived articles must be restored to a draft before editing or republishing. Every update advances revision. Republishing assigns a new publication time; unpublishing/archiving retains the previous timestamp for admin history.

Publishing is an editorial workflow, not an automated truth detector. The editor remains responsible for supporting factual claims with appropriate sources. Draft preview is under `/admin/articles/:id/preview` and uses a protected admin endpoint. It never makes a draft visible through reader routes. The edit page explicitly previews the **saved** version; unsaved changes must be saved first.

TipTap stores a bounded structured document. Supported nodes include paragraphs, H2/H3 headings, lists, blockquotes, text, hard breaks, and uploaded images; supported marks include bold, italic, strike, underline and HTTPS links. The backend validates nesting/depth/node/text limits and reconstructs only approved fields. Arbitrary HTML, scripts, event-handler attributes, unsafe URL schemes, embedded frames, and base64 images are rejected. Inline images must use registered media from this project's bucket.

The reader renders semantic React elements and escaped text; it never uses `dangerouslySetInnerHTML`. It revalidates document shape before rendering. External links receive `noopener noreferrer`; table-of-contents anchors are generated for longer heading structures. The editor is loaded as a separate route chunk rather than included in every reader route. TipTap setup follows its [React documentation](https://tiptap.dev/docs/editor/getting-started/install/react).

Reading time is `max(1, ceil(word_count / words_per_minute))`, default 200. Set server-only `ARTICLE_READING_WORDS_PER_MINUTE` (100–500) to change the speed. Plain text joins block boundaries and hard breaks while preserving words split across formatting marks. Client reading-time or status values are rejected by strict input allowlists.

## Search, filtering and related content

Article title/summary are indexed through a generated English `tsvector` and GIN index. Supabase's parameterized `textSearch`/websearch query handles input without interpolating user SQL. Category, tag, featured, status/admin, newest/oldest and stable ID ordering combine with pagination (default 12, maximum 100). Search is debounced in the UI and query parameters preserve filters/navigation. PostgreSQL's [full-text search documentation](https://www.postgresql.org/docs/current/functions-textsearch.html) describes the matching semantics; this is word-based search rather than substring/autocomplete search.

Related content is selected from real published records: shared category first, then shared tags, then recent publication. IDs are deduplicated and the current article is excluded. Deactivated categories hide their articles without deleting anything. Tags in use cannot be deleted; editors can remove associations or rename the tag instead.

## Storage and media lifecycle

`article-media` is a **public** bucket for assets intended for publication. Its maximum file size is 5 MB and allowed MIME types are JPEG, PNG and WebP. Images on drafts are still publicly accessible if their URLs are known; the upload UI explicitly states this. Do not upload private material. There are no authenticated browser upload/delete policies for this bucket: the authorized backend uses server-only Storage credentials. Storage metadata reads are admin-restricted.

Uploads use multipart field `file`. Multer limits count/size/type; Sharp verifies actual bytes and MIME consistency, rejects unsupported/animated images, applies a pixel limit, strips metadata, bounds dimensions and re-encodes WebP. Filenames are generated UUIDs under `articles/<uuid>.webp`. The database stores paths, not base64 images or privileged URLs. Upload failures attempt object cleanup if metadata insertion fails.

Saving an article locks registered media and stores its reference links transactionally with tag links/content. Replacing/removing covers or inline images attempts to delete old objects only when no article still references them. Explicit deletion checks references and reserves the row before removing Storage content; a failed Storage removal restores its ready state. Shared or archived-article images remain protected. The media picker can remove unused uploads from abandoned drafts.

If the process stops between reserving a deletion and final cleanup, a `DELETING` row may need administrative review after confirming it has no references. There is no undocumented background garbage collector. A failed cleanup does not turn a successful article save into a failed mutation. The migration preserves an existing bucket with matching settings and stops for review rather than silently changing an incompatible bucket configuration.

## Conflict patch

Live testing exposed `40001` being used for ordinary stale-edit/media conflicts. The hosted PostgREST version retried that serialization-failure signal, causing timeouts. `007` changes only those business exceptions to `PT409` while preserving existing definitions/privileges. Backend prechecks return prompt conflicts for already-stale revisions or already-referenced media; database locks/revision checks remain authoritative for races. Apply `007` for that final database-level guarantee.

See the primary [PostgREST error-code documentation](https://docs.postgrest.org/en/v13/references/errors.html) and [retry fix history](https://github.com/PostgREST/postgrest/blob/main/CHANGELOG.md). Earlier Phase 3/4 conflict functions are not broadly rewritten in this phase.

## Routes and commands

Reader routes: `/library`, `/library/:slug`, `/library/bookmarks`. Admin routes: `/admin`, `/admin/articles`, `/admin/articles/new`, `/admin/articles/:id/edit`, `/admin/articles/:id/preview`, `/admin/categories`. Existing `/admin/activities` now links to filtered recommendation rules; `/admin/recommendations?activityId=...` reuses its existing editor and validated condition/activity selection.

The admin overview uses actual backend counts for total/published/draft articles, categories, active activities and active rules. It is a content-management overview, not Phase 6 reporting. Detailed endpoint contracts are in [API documentation](api.md#phase-5-implemented-endpoints).

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
pnpm format:check
pnpm db:check-content
```

Optional live acceptance, after building and starting a stable API:

```powershell
pnpm verify:phase5-live --run
```

It creates three disposable confirmed accounts without sending emails, grants admin only to its new editor account, exercises real APIs/Storage/RLS, and removes its own articles/media/taxonomy/accounts in `finally`. It never modifies existing users. Use `LIVE_API_URL` to target a dedicated compiled API instead of a watcher that may restart during builds. An interrupted process may require reviewing its disposable resources. Tokens/passwords/keys are not printed or stored by the script.

## Actual verification and limits

The local PostgreSQL/content/image suite passed **15 tests**, including previous phases. It executes the migrations/seeds and checks draft isolation, owner RLS, direct-write denial, duplicate bookmarks, atomic rollback, revisions, `PT409`, media references, source/URL validation, XSS payload rejection, image bytes, and reading metrics. Browser tests use real components under explicit test-only identity/HTTP fixtures; they are separate from live persistence verification. Full command results are recorded in [development progress](development-progress.md).

Live Supabase acceptance passed sign-in, draft creation/editing, validation and stale conflicts, publishing/unpublishing/archiving/restoring, generated reading time, search/category/tag filters, pagination, details/related content, bookmark idempotency, two-user RLS, unavailable saved links, category deactivation, tag protection, real Storage upload/download and malformed-image rejection. It also exercised the existing assessment, activity/checklist and recommendation endpoints. All disposable resources were removed. The permanent 12-article seed was applied separately and verified idempotent.

Pending operational work: apply/reconcile `005`, apply `007`, then rerun readiness/live checks. The new conflict SQL is verified locally; its hosted marker remains absent at the latest probe. No hosted SQL was executed by the agent. Native browser notification delivery, SMTP/recovery and exhaustive assessment/questionnaire acceptance are not newly claimed. Cross-browser/accessibility/performance audits remain broader work. Existing dependency annotation and main-bundle warnings remain; the admin editor has its own lazy-loaded chunk.

Phase 6 can build on these content APIs after the pending database patches are installed. No analytics or PDF report implementation was started.
