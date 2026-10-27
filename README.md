<!-- Phase 3 extension: see docs/assessment-scoring.md and development-progress.md for verified status. -->

# ScreenWise Wellness

Digital wellness for students and working professionals, built as a pnpm/Turborepo monorepo with separate React/Vite and Express applications.

**Phases 1–6 have local implementations.** Phase 6 adds real-data dashboards, selected-range analytics, PDF wellness reports, private admin aggregates and cross-module refreshes. Hosted Phase 6 acceptance is pending: the 2026-10-26 read-only check found integrity patch `005` missing, conflict patch `007` installed and new analytics migration `008` absent. See [Phase 6 setup and semantics](docs/phase6-analytics.md). No Git repository was initialized; Phase 7/8 work has not started.

## Start locally

Use Node **24 LTS** and pnpm **10.18.3**.

```powershell
cd "D:\personal projects\screenwise-wellness"
pnpm.cmd install
pnpm.cmd dev
```

Frontend: http://localhost:5173. Backend health: http://localhost:4000/api/v1/health. PowerShell users can use .cmd to avoid execution-policy restrictions.

Follow **[Supabase setup](docs/supabase-setup.md)** and the current **[Phase 5 migration/Storage guide](docs/phase5-library.md)**. Run `pnpm db:check-content` before SQL changes. Apply only pending migrations; do not rerun the already-installed Phase 5 table migration. Configure authentication/redirects and restart dev when configuration changes. Without configuration, the public site runs and private access fails closed.

## Commands

| Command                               | Purpose                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| pnpm dev                              | Build shared package and run web/API together                                |
| pnpm dev:web / pnpm dev:api           | Start an individual app                                                      |
| pnpm build                            | Compile shared/API and build Vite assets                                     |
| pnpm typecheck                        | Strict TypeScript checks                                                     |
| pnpm lint                             | Shared ESLint checks                                                         |
| pnpm format / pnpm format:check       | Format / verify formatting                                                   |
| pnpm test                             | Shared-schema security and PGlite migration/RLS/transaction tests            |
| pnpm test:e2e                         | Chromium public UI, guards and unauthenticated API tests                     |
| pnpm exec playwright install chromium | Install browser for the E2E suite                                            |
| pnpm db:check-content                 | Read-only schema, conflict-patch, and bucket readiness checks                |
| pnpm db:seed-library --run            | Insert missing educational library seeds after building; preserves edits     |
| pnpm db:seed-assessments --run        | Add and publish missing educational assessments; preserve existing drafts    |
| pnpm db:seed-activities --run         | Add missing goal activities and link unassigned seed recommendation rules    |
| pnpm verify:phase5-live --run         | Live API/Storage/RLS acceptance with disposable accounts/content and cleanup |

## Configuration

Copy apps/api/.env.example and apps/web/.env.example to .env in the same respective folders.

API requires SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY; also supports legacy SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY aliases. FRONTEND_URL defaults to http://localhost:5173; PORT to 4000. Web uses VITE_API_URL=/api/v1, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (legacy VITE_SUPABASE_ANON_KEY accepted). **Only public/anon keys belong in the frontend.** Vite proxies /api to Express. Changing PORT requires updating the Vite proxy.

Email callbacks: /auth/callback and /reset-password. SDK sessions use PKCE and sessionStorage, persist across refreshes, and require the requesting browser tab for recovery links. No localStorage tokens, custom JWT system, or pretend authentication exists. See setup instructions for SMTP, password policy, rate limits, admin provisioning and a full live acceptance checklist.

## Structure

```text
apps/
  web/src/
    app/{layouts,providers,router}/
    components/{ui,common,layout}/
    features/{auth,onboarding,profile,dashboard,...}/
    hooks/ lib/ services/ stores/ styles/
  api/src/
    config/                 Env and isolated Supabase clients
    middleware/             Token verification, roles, errors
    modules/users/          Routes, controllers, services, repository
    modules/health/         Public liveness endpoint
packages/
  shared/                   Shared strict Zod schemas/types/constants
  eslint-config/
  typescript-config/
supabase/migrations/        Identity, Storage, assessments, and wellness SQL
docs/
tests/                      Local PostgreSQL/schema and browser tests
```

Existing React 19, Tailwind 4, shadcn/Radix, React Router, TanStack Query, Axios, Zustand, RHF/Zod, Lucide, Framer Motion and Sonner remain. Recharts is reserved for later data-backed analytics. The API retains Express 5/Pino/Helmet/CORS and adds Supabase, rate limiting, Multer and Sharp. Inter fonts are bundled locally.

## Status and documentation

- [Development progress](docs/development-progress.md): actual checks and unverified live acceptance criteria.
- [Supabase setup](docs/supabase-setup.md): migrations, keys, email callbacks and admin provisioning.
- [Architecture](docs/architecture.md): session/data flow and security boundaries.
- [Database](docs/database.md): current schema/RLS and retained future design.
- [API](docs/api.md): implemented account, assessment, wellness, library and admin endpoints versus future contracts.
- [Phase 4 wellness](docs/phase4-wellness.md): migration commands, timer, progress/streak formulas, timezones, reminder limitations, and hosted acceptance requirements.
- [Phase 5 library](docs/phase5-library.md): exact pending SQL order, Storage policies, rich-text validation, article lifecycle, search, seeding and live verification.

Chromium tests cover credential-free guards and isolated Phase 4/5 UI flows using explicit test-only identity/HTTP fixtures. Local SQL tests execute real migrations/seeds through PGlite. A separate Phase 5 live acceptance script exercised real confirmed sign-in, article persistence/publishing, Storage, search, bookmarks and two-user hosted RLS, then removed its temporary resources. Production features use Supabase persistence. SMTP/recovery and broader cross-browser audits remain separate acceptance work.

The production build retains non-blocking dependency annotation and bundle-size warnings. Shared-source edits during dev require rebuilding shared or restarting dev. Deployment is out of scope. Profile and wellness settings may save across separate requests; final onboarding is transactional. Avatar URLs expire after one hour and refresh when profile data is loaded again.

## Phase 6 dashboard and reports

Open /dashboard, /progress and (as ADMIN) /admin/analytics. Run pnpm db:check-analytics alongside pnpm db:check-content before SQL changes. Review/apply pending 005, retain installed 006/007, then apply 008 once. Real signed-in hosted acceptance remains pending. See docs/phase6-analytics.md and docs/development-progress.md for actual verification and limits. The dropdown follow-up standardizes native-select chevrons, themed option colors, focus states and shared Radix popup sizing/positioning across the app.
