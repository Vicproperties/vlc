# Project Progress

Read this first when resuming work. Then check `git status` / `git log`, verify the current
implementation (`npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run test:rls`),
and continue from **Next task** below. Do not repeat completed work or overwrite working code.

## Current status

| Item          | Value                                                                                                                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current stage | Stage 3 — Database and Security Foundation                                                                                                                                                            |
| Stage status  | **Complete — awaiting owner approval**                                                                                                                                                                |
| Last updated  | 2026-11-04                                                                                                                                                                                            |
| Next task     | Owner: reset dev DB password (risk R-009) and approve Stage 3. Then present the Stage 4 (Admin authentication & dashboard foundation) plan. Stage 4 needs a Resend account + verified sending domain. |

## Stage history

| Stage                                            | Status                      | Approved   |
| ------------------------------------------------ | --------------------------- | ---------- |
| 1. Planning & architecture                       | Complete                    | 2026-11-03 |
| 2. Setup & design system                         | Complete                    | 2026-11-04 |
| 3. Database & security foundation                | Complete, awaiting approval | —          |
| 4. Admin auth & dashboard shell                  | Not started                 | —          |
| 5. Properties & estates                          | Not started                 | —          |
| 6. Public website                                | Not started                 | —          |
| 7. Inspections & enquiries                       | Not started                 | —          |
| 8. Content management                            | Not started                 | —          |
| 9. Blog                                          | Not started                 | —          |
| 10. Customer accounts                            | Not started                 | —          |
| 11. Marketing, announcements, analytics, consent | Not started                 | —          |
| 12. Testing, security, deployment                | Not started                 | —          |

---

## Stage 3 — Database and Security Foundation

### Completed

- Supabase CLI 3.0 (dev dependency), `@supabase/supabase-js` 2.118, `@supabase/ssr` 0.12.7, `pg` (tests only).
- 13 migrations applied to the dev project (`tcfpnbliwjlinwlgzmkc`): foundation, identity & security, properties, enquiries, blog, content & marketing, imports & analytics, access control (privileges + RLS on every table), storage, last-super-admin maintenance override, slug defaults, log actor retention, foreign-key indexes. Details: `docs/database.md`.
- Private schema for sessions / OTP / rate limits (not reachable through the API).
- Permission model in SQL: `is_verified_admin()` (active admin + OTP-verified session for this JWT), `has_admin_permission(module, action)`.
- Database-enforced rules: publish permission, duplicate flagging/blocking, computed discount/effective price, kind-specific fields, inspection snapshots, immutable logs with retention purge, last-super-admin guard.
- Storage buckets with MIME/size limits and permission-based upload policies.
- Supabase clients: `server.ts` (user/RLS), `public.ts` (anon, cache-safe), `browser.ts`, `service.ts` (service role, server-only).
- Generated types `src/types/database.ts`.
- `scripts/with-env.mjs` (runs CLI with secrets redacted); npm scripts `db:push`, `db:push:dry`, `db:types`, `test:rls`.
- Env var renamed `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`; CLI-only vars documented.
- CSP allows the Supabase origin for images and API.
- **Colour change at owner request:** light purple + white palette; tokens renamed `forest*` → `brand*` (see `docs/design-system.md`).

### Database changes

Migrations `20261104000001` … `20261104000013` (all applied to dev). Seeded data: `building_types` (10 types, owner-approved), singleton rows for `site_settings` and `cookie_settings` (empty values). No company content seeded.

### Tests and results (2026-11-04)

| Check                                        | Result                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run test:rls` (live API, 7 actor types) | **33 / 33 pass**; cleanup verified (0 users / properties left)                 |
| Supabase `db lint` (public, private)         | No errors                                                                      |
| Supabase Security Advisor                    | 3 accepted findings (ADR-001 views, 2 self-checking RPCs); INFO only otherwise |
| Supabase Performance Advisor                 | 20 unindexed FKs → fixed (migration 0013)                                      |
| typecheck / lint / prettier                  | Pass                                                                           |
| Unit tests                                   | 21 / 21 pass                                                                   |
| E2E (production build)                       | 9 pass, 1 skipped (mobile-only)                                                |
| Client bundle secret scan                    | Pass (now also checks DB URL and access token)                                 |
| Visual review (new colours)                  | Home, `/design`, `/admin`, mobile — correct; contrast AA verified              |

### Issues found and fixed during the stage

- `is_service_role()` would have trusted every caller inside SECURITY DEFINER functions — rewritten.
- Immutable logs blocked deleting any user with history — logs now keep actor id + email without FK (0012).
- Log retention purge was impossible under immutability — dedicated purge function.
- Last-super-admin guard prevented test cleanup — direct-DB-only override (0010).
- Required `slug` in generated types — defaults added (0011).
- Malformed `.env.local` (brackets, spaces) — normalised.

### Outstanding issues

- **R-009: owner must reset the development database password** (it was printed in a session log) and update `SUPABASE_DB_URL`.
- Admin session idle-touch, OTP flow and pg_cron purge schedule are Stage 4 work.
- Supabase project display name is the default ("website4vic@gmail.com's Project"); optionally rename to `vlc-dev`.

---

## Stage 2 — Project Setup and Design System

### Completed

- Next.js 16.4.5 (App Router, Turbopack, Cache Components, Partial Prefetching), React 19.3, TypeScript strict, Tailwind CSS v4, ESLint, Prettier (+ Tailwind class sorting).
- Node 24 engine; `@types/node` aligned to 24.
- Design tokens (Direction A "Editorial Heritage") in `src/app/globals.css`; default Tailwind palette removed so only approved colours exist.
- Fonts Newsreader + Hanken Grotesk, self-hosted via `next/font`.
- UI components: Button / ButtonLink, Spinner, FormField, Input, Textarea, Select, Checkbox, Radio, PasswordInput (eye / eye-off), PhoneInput (international, Nigeria default), Dialog / Drawer (native `<dialog>`), Tabs, Toast, Table, Pagination, Skeleton, EmptyState, ErrorState, StatusText, Price, DiscountLabel.
- Utilities: naira / land-size / price-period / date formatting, slugify, phone parsing (libphonenumber-js), pricing rules (`resolvePriceDisplay`, `calculateDiscountPercent`), Zod-validated env (public + `server-only` secrets).
- Layout shells: public (skip link, sticky header, desktop + mobile nav, footer) and admin (sidebar, mobile drawer, page header). Holding homepage, 404 and error pages.
- Security baseline: CSP, HSTS (no preload yet), nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, `poweredByHeader: false`, `X-Robots-Tag: noindex` + robots metadata on `/admin`.
- `/design` (component showcase) and `/admin` shell are development-only (404 in production).
- Docs: architecture, design system, conventions, security risk register, README, `.env.example`.
- Git initialised on `main`.

### Files created / modified

- Config: `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json` (scaffold), `eslint.config.mjs` (scaffold), `.prettierrc.json`, `vitest.config.mts`, `playwright.config.ts`, `.gitignore`, `.env.example`
- App: `src/app/layout.tsx`, `globals.css`, `not-found.tsx`, `error.tsx`, `(public)/layout.tsx`, `(public)/page.tsx`, `admin/layout.tsx`, `admin/(dashboard)/layout.tsx`, `admin/(dashboard)/page.tsx`, `design/page.tsx`, `design/design-interactive.tsx`
- Components: `src/components/ui/*` (15 files), `src/components/public/site-header.tsx`, `site-nav.tsx`, `site-footer.tsx`, `src/components/admin/admin-sidebar.tsx`, `page-header.tsx`
- Lib / config / features: `src/lib/cn.ts`, `format.ts`, `slug.ts`, `phone.ts`, `env/client.ts`, `env/server.ts`, `src/config/site.ts`, `admin-nav.ts`, `src/features/properties/pricing.ts`
- Tests: `tests/unit/*.test.ts(x)` (4 files), `tests/unit/setup.ts`, `tests/unit/stubs/server-only.ts`, `tests/e2e/smoke.spec.ts`
- Scripts: `scripts/check-client-secrets.mjs`
- Docs: `README.md`, `PROJECT_PROGRESS.md`, `docs/architecture.md`, `docs/design-system.md`, `docs/conventions.md`, `docs/security/risk-register.md`
- Removed scaffold files: `src/app/page.tsx`, `public/*.svg`

### Database changes

None (database work begins in Stage 3).

### Tests and results (2026-11-04)

| Check                                                               | Result                                                                                                                                          |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                 | Pass                                                                                                                                            |
| `npm run lint`                                                      | Pass (0 problems)                                                                                                                               |
| `npm test` (Vitest)                                                 | 21 / 21 pass — pricing rules, formatting, slugs, pagination window, phone parsing (NG + international), PasswordInput toggle                    |
| `npm run test:e2e` (Playwright, production build, desktop + mobile) | 9 pass, 1 skipped (mobile-only test on desktop) — headers, dev pages 404 in prod, admin `X-Robots-Tag`, 404 page, mobile menu open/Escape close |
| `npm run check:secrets`                                             | Pass — no server-only names/values in client bundle                                                                                             |
| `prettier --check`                                                  | Pass                                                                                                                                            |
| Manual visual review (screenshots desktop 1440px + mobile 390px)    | Home, `/design`, `/admin`, dialog — no console errors                                                                                           |

### Issues found and fixed during the stage

- Hydration mismatch in PhoneInput (`Intl.DisplayNames` differs between Node and browsers) — fixed with deterministic first render.
- Admin shell crash (server passed icon components to a client component) — sidebar now receives plain module keys.
- Country selector label truncated — widened.
- HSTS `preload` removed until domain is confirmed; deprecated `interest-cohort` policy removed.
- Stale orphan server made one e2e run fail — Playwright now always starts a fresh server.

### Outstanding issues

- ~~Company name~~ — confirmed as "Vic Land and Property" (2026-11-04).
- `npm audit`: 16 moderate advisories, dev tooling only (ESLint → minimatch). Risk R-006.
- ~~GitHub remote~~ — connected to https://github.com/Vicproperties/vlc (2026-11-04).
- Nav links to pages not yet built (`/properties`, `/about`, …) return 404 until Stages 6–9.
