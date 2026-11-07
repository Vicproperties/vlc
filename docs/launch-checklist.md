# Launch checklist

Status as of 2026-11-07. "Owner" items need the site owner's accounts.

## Done

- [x] Domain viclandandproperty.com on Vercel, HTTPS, security headers (CSP, HSTS, frame and content-type protection).
- [x] Live environment variables set in Vercel (Supabase, Resend email, Turnstile, OTP secret).
- [x] Real Cloudflare Turnstile keys on all public forms.
- [x] Public sign-up of dashboard accounts disabled in Supabase (live and test projects).
- [x] Owner super admin signs in with email code; sub-admins invited from Admin Users.
- [x] Row-level security on every table; 80 database access tests pass.
- [x] Separate test database; automated tests no longer touch live data (R-027).
- [x] Image library upgraded (sharp 0.35.5); `npm audit` reports 0 vulnerabilities.
- [x] GitHub Actions checks on every push (typecheck, lint, format, unit tests).
- [x] Cookie consent, privacy-friendly first-party analytics, newsletter double opt-in.
- [x] Deployment runbook: `docs/deployment-runbook.md`.

## Owner actions still open

- [ ] **CRON_SECRET** in Vercel → Settings → Environment Variables (Production): any long random text. Enables the daily clean-up of old visit records (R-028).
- [ ] **Supabase Pro** for the live project (optional, $25/month): daily backups, and leaked-password checks (R-016). Without it, deleted data cannot be recovered.
- [ ] **Legal review** of Privacy Policy, Terms and cookie text by a Nigerian lawyer (NDPA 2023) (R-005).
- [ ] **DMARC record** for the sending domain in the DNS provider, e.g. `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:<owner inbox>`. Improves email delivery.
- [ ] **Google Search Console**: add the domain and submit `https://viclandandproperty.com/sitemap.xml`.
- [ ] Replace sample text with real company details, listings, photos and testimonials where still missing (nothing is invented by the site).

## Later

- [ ] HSTS `preload` (R-007): only once every subdomain is permanently HTTPS.
- [ ] Clean-up job for images uploaded into blog articles that were never saved (small storage waste).
