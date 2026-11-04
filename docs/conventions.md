# Coding Conventions

## Structure

- `src/app` — routes only (thin). Public routes in `(public)`, customer area in `(account)`, admin in `admin/`.
- `src/features/<domain>` — `actions.ts` (server actions), `queries.ts` (server reads), `schemas.ts` (Zod),
  `types.ts`, `components/`. Business logic lives here, not in route files or UI components.
- `src/components/ui` — design-system primitives, no data fetching.
- `src/components/public`, `src/components/admin` — layout pieces for each experience.
- `src/lib` — framework-agnostic utilities (`format`, `phone`, `cn`) and integrations (`supabase`, `security`).
- `src/lib/env` — `client.ts` exposes only `NEXT_PUBLIC_*`; `server.ts` imports `server-only`.

## TypeScript

- `strict` mode; no `any` (use `unknown` and narrow). No non-null assertions on external data.
- Validate every external input (forms, params, search params, CSV, webhooks) with Zod.
- Server actions return `{ ok: true, data } | { ok: false, error, fieldErrors? }`. Never throw raw DB errors to the client.

## React / Next.js

- Server Components by default; add `"use client"` only when interactivity requires it, and keep client islands small.
- Read the bundled docs in `node_modules/next/dist/docs/` before using a Next.js API — this version (16.x) differs from older material.
- No hardcoded production data (listings, company details, testimonials, statistics).

## Authorization

- Every dashboard page, Server Action and Route Handler calls `requireAdmin()` or
  `requireAdminPermission(module, action)` from `src/features/auth/admin-session.ts` itself.
  Layouts and `src/proxy.ts` are not an authorization boundary.
- Use the RLS-scoped `createClient()` for admin data so the database enforces permissions again.
  The service client is only for the audited cases listed in `src/lib/supabase/service.ts`.
- Session reads sit behind `<Suspense>` (Cache Components) and are never cached across requests.

## Styling

- Tailwind utilities backed by tokens in `src/app/globals.css`. Do not introduce raw hex colours in components.
- Design rules: no gradients, no emojis, no badges/pills, radius 0–2px, shadows only for overlays, transitions subtle (150–250ms).
- Every interactive element has a visible focus state and an accessible name.

## Naming

- Files: `kebab-case.ts(x)`. Components: `PascalCase`. Functions/variables: `camelCase`. DB: `snake_case`.
- Booleans read as questions: `isActive`, `hasPromotion`.

## Git

- Commit at the end of each approved stage (or meaningful sub-task). Never commit `.env*` except `.env.example`.
