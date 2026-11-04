# Project Progress

Read this first when resuming work. Then check `git status` / `git log`, verify the current
implementation (`npm run typecheck && npm run lint && npm test && npm run test:e2e`), and continue
from **Next task** below. Do not repeat completed work or overwrite working code.

## Current status

| Item          | Value                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current stage | Stage 3 — Database and Security Foundation (planning)                                                                                                                           |
| Stage status  | Stage 2 approved 2026-11-04; Stage 3 plan presented, awaiting approval                                                                                                          |
| Last updated  | 2026-11-04                                                                                                                                                                      |
| Next task     | Owner approves Stage 3 plan and creates the development Supabase project (credentials into `.env.local`); then implement Stage 3 task 1 (Supabase CLI + migration scaffolding). |

## Stage history

| Stage                                            | Status      | Approved   |
| ------------------------------------------------ | ----------- | ---------- |
| 1. Planning & architecture                       | Complete    | 2026-11-03 |
| 2. Setup & design system                         | Complete    | 2026-11-04 |
| 3. Database & security foundation                | Not started | —          |
| 4. Admin auth & dashboard shell                  | Not started | —          |
| 5. Properties & estates                          | Not started | —          |
| 6. Public website                                | Not started | —          |
| 7. Inspections & enquiries                       | Not started | —          |
| 8. Content management                            | Not started | —          |
| 9. Blog                                          | Not started | —          |
| 10. Customer accounts                            | Not started | —          |
| 11. Marketing, announcements, analytics, consent | Not started | —          |
| 12. Testing, security, deployment                | Not started | —          |

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
