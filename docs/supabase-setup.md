# Supabase setup and live verification

Phases 2–5 are implemented. The latest 2026-10-18 probe found Phase 3/4 core tables and Phase 5 tables/Storage present, superseding earlier missing-table notes. The Phase 4 `archived_at` column and Phase 5 conflict marker are still absent. No hosted SQL migrations were executed by the agent, but the library seed and bounded live CMS/Storage/RLS verification were performed through real APIs. See the [current Phase 5 setup guide](phase5-library.md) before applying anything.

## 1. Configure a development project

Create or select your own Supabase development project. In its SQL editor, run these files **once, in order**, on the fresh Phase 1 database (Phase 1 had no executable migrations):

1. `supabase/migrations/202610160001_phase2_identity.sql`
2. `supabase/migrations/202610160002_private_avatars.sql`
3. `supabase/migrations/202610160003_phase3_assessments.sql`
4. `supabase/migrations/202610160004_phase4_wellness.sql`
5. `supabase/migrations/202610180005_phase4_integrity.sql`
6. `supabase/migrations/202610180006_phase5_library.sql`
7. `supabase/migrations/202610180007_phase5_conflicts.sql`

Apply only pending files. The observed hosted database already has `006` tables: do not rerun it. Review/apply `005` if pending and then `007`; run `pnpm db:check-content` to check dependencies. Seeds are separate: `seed-phase3.sql`, `seed-phase4.sql`, and `seed-phase5.sql` as needed. Apply integrity before Phase 4 linking to preserve recommendation revisions. Seeds create educational definitions, not users/completions. The hosted library's 6 categories, 6 tags and 12 articles are already seeded. Full commands and limitations are in [Phase 5](phase5-library.md).

Each file has a transaction. Keep the files as the migration history. Do not rerun the initial create-table migration on a populated schema. Review any existing tables/policies before applying it to a previously used project. For teams using Supabase CLI, link the intended development project and use its normal migration workflow instead of separately applying the same files in SQL editor.

The first migration creates profiles, preferences and selected wellness interests; initializes existing/new Auth users; synchronizes Auth email changes; and defines server-only transactional functions. The second creates a **private** avatars bucket and owner-read policy. No seed users or default administrators exist.

## 2. Set application environments

Copy each application's `.env.example` to `.env`. Neither file is committed.

Backend `apps/api/.env`:

```dotenv
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_KEY
LOG_LEVEL=info
```

Frontend `apps/web/.env`:

```dotenv
VITE_API_URL=/api/v1
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

Use both apps with the **same project**. Current publishable/secret keys are supported. Legacy aliases are `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `VITE_SUPABASE_ANON_KEY`. An anon/service-role JWT may also be supplied in the corresponding public/server key variable. Never put the secret/service-role key in a VITE variable.

Restart `pnpm dev` after changing configuration. Without configuration, the public site/health endpoint work, auth forms show an explicit configuration notice, protected routes redirect to login, and bearer-authenticated API calls fail with 503. Production startup requires complete backend configuration.

## 3. Auth and email configuration

Enable email/password authentication. Set Site URL to `http://localhost:5173`. Add these exact redirect URLs:

- `http://localhost:5173/auth/callback`
- `http://localhost:5173/reset-password`

Use the same hostname consistently (localhost and 127.0.0.1 are different origins). In production use the deployed HTTPS URLs and do not allow unrestricted wildcard redirects. Keep email confirmation enabled unless deliberately testing immediate-session signup. Configure SMTP for dependable confirmation/recovery delivery, rate limits in Supabase Auth, and a server-enforced password policy matching the UI (12+ characters, uppercase, lowercase, number and symbol). The UI policy alone cannot prevent direct Auth API requests with weaker passwords.

Use Supabase's normal confirmation/recovery templates that honor RedirectTo. The SDK uses PKCE: email links resolve to a short-lived authorization code, not URL access tokens. The code verifier is stored in sessionStorage; complete confirmation/recovery in the **same browser tab that requested it** (paste the emailed URL into that tab if your mail app opens a new tab). If the verifier is missing or the link expires, request another recovery link. Confirmed signup users can sign in normally even if the confirmation session could not be restored.

Sessions survive refreshes in the current tab; they are not intended to survive closing the tab/browser. No Remember me control is offered. Supabase handles refresh; no custom JWT system exists. Logout revokes the current local session through Supabase and clears frontend account caches. Other devices are not signed out by this local-scope logout. This browser-storage strategy is vulnerable to same-origin script compromise like other browser-accessible session mechanisms; it avoids localStorage credentials but is not an HttpOnly-cookie design.

## 4. Provision the first administrator

First register and confirm an ordinary account. Independently verify its UUID/email in Supabase Auth. In the SQL editor, using the trusted project administrator identity, run:

```sql
update public.profiles
set role = 'ADMIN'
where id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid
  and email = 'verified-admin@example.com'
returning id, email, role;
```

Verify that exactly the intended row was returned. Reload/sign in again to refresh frontend profile state. There is no role-update HTTP API, and signup metadata never controls role. Revoke with a trusted update to USER. Never distribute the secret key to administrators' browsers.

## 5. Live acceptance checklist (not executed here)

Use two distinct test accounts A/B plus an explicitly provisioned admin.

- Register A; verify confirmation screen when enabled, then confirm and log in.
- Verify profile/preferences were created; onboarding routes appear until completion.
- Save each onboarding step, reload and confirm persisted values. Complete all steps; confirm profile flag and unique goal rows. Resubmit without duplicates.
- Refresh the page; verify session restoration. Confirm automatic token refresh after the access-token lifetime.
- Edit profile/device/wellness/appearance/notification preferences; reload and inspect actual database rows.
- Upload a small PNG/JPEG/WebP; verify the private object owner path and signed display URL. Reject oversized, SVG and corrupt files.
- Request recovery email and complete it in the requesting tab. Test expired/missing-verifier links. Verify old password no longer works.
- Change password from Settings using current-password reauthentication.
- Sign out; verify private views and user caches clear.
- Without a bearer token, all user/admin APIs return 401. With invalid/expired tokens on a configured project, verify 401.
- A cannot read B's profile/preferences/goals through Supabase or Express. Supabase authenticated table writes and onboarding RPC execution must be denied.
- A cannot grant itself ADMIN through signup metadata, profile PATCH, or direct table update.
- Regular users receive Access denied at /admin and 403 at /api/v1/admin/access; provisioned admins receive success.
- Test actual Storage RLS using both identities and signed-URL expiry; PGlite only tests the SQL policy logic.
- Account deletion cascades PostgreSQL records. Storage object cleanup requires an administrative cleanup workflow before production account-deletion support.

## References

The implementation follows [Supabase API key guidance](https://supabase.com/docs/guides/getting-started/api-keys), [PKCE sessions](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Auth session storage](https://supabase.com/docs/reference/javascript/auth), and [Storage access controls](https://supabase.com/docs/guides/storage/security/access-control).

## Phase 3 installation

Once Phase 2 migrations are installed, run supabase/migrations/202610160003_phase3_assessments.sql once in SQL editor, then supabase/seed-phase3.sql. The seed can be rerun and preserves existing slugs/admin edits. With psql and a configured database connection, use psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <file> for each file in order. No database connection string was available during implementation; hosted SQL was not executed. Complete a real user assessment, verify results/history/trends and wellness-plan status persistence, then test admin creation/edit/publication with a provisioned admin and rejection with a regular user before considering live acceptance complete.

## Current Phase 6 setup (2026-10-26)

This supersedes older readiness observations above: `007` is now installed, `005` is still missing, and the new `008` analytics migration is absent. Review/apply pending `005`, keep existing `006` and `007`, then apply `202610260008_phase6_analytics.sql` once. Do not rerun installed create-table migrations. Fresh projects apply all files `001`–`008` once in order. No Phase 6 seed or environment variable is needed. Use `pnpm db:check-content` and `pnpm db:check-analytics`; follow the [complete Phase 6 guide](phase6-analytics.md) for SQL editor/psql instructions and signed-in acceptance.
