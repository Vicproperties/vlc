# ADR-002: Static Content Security Policy for the admin area (no nonces)

Status: Accepted (Stage 4, 2026-11-04)

## Context

Stage 1 planned to evaluate a nonce-based `script-src` for the dynamic admin area (risk R-002).
The project uses Cache Components with Partial Prerendering: every admin route has a static
shell prerendered at build time, with session-dependent content streamed in behind Suspense.

The bundled Next.js 16 guide (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`)
states that Partial Prerendering is incompatible with nonce-based CSP, because static-shell
scripts cannot carry a per-request nonce. A nonce policy would require disabling Cache
Components for `/admin`, losing the instant static shell and complicating the configuration.

## Decision

Keep the single static CSP from `next.config.ts` for the whole site, including `/admin`:
`default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and explicit
`img-src`/`connect-src` for Supabase.

XSS is mitigated by layers that do not depend on nonces:

- React escapes all rendered values; `dangerouslySetInnerHTML` is not used in the admin area.
  Rich text (TipTap, Stage 9) must be sanitised server-side before storage and rendering.
- No third-party scripts are loaded in the admin area.
- Session cookies are only usable together with a server-side admin session that requires a
  fresh emailed code, and all authorization happens on the server and in RLS.
- `X-Frame-Options: DENY` / `frame-ancestors 'none'` prevent clickjacking; Server Actions
  check the request origin (built into Next.js).

## Consequences

- R-002 stays open only for future embeds (YouTube, Turnstile), which add explicit sources.
- Re-evaluate when Next.js supports hash-based CSP (experimental SRI) in a stable release, or
  if a third-party script is ever added to the admin area.
