# Project Progress

Read this first when resuming work. Then check `git status` / `git log`, verify the current
implementation (`npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run test:rls`),
and continue from **Next task** below. Do not repeat completed work or overwrite working code.

## Current status

| Item          | Value                                                                                                                                                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current stage | Stage 7 — Inspections & Enquiries                                                                                                                                                                                                             |
| Stage status  | **Complete — awaiting owner approval**                                                                                                                                                                                                        |
| Last updated  | 2026-11-04                                                                                                                                                                                                                                    |
| Next task     | Owner: try an inspection request on a published property and the /contact form, then handle them in the dashboard; approve Stage 7. Owner still to reset dev DB password (R-009). Then present the Stage 8 (Website content management) plan. |

## Stage history

| Stage                                            | Status                      | Approved   |
| ------------------------------------------------ | --------------------------- | ---------- |
| 1. Planning & architecture                       | Complete                    | 2026-11-03 |
| 2. Setup & design system                         | Complete                    | 2026-11-04 |
| 3. Database & security foundation                | Complete                    | 2026-11-04 |
| 4. Admin auth & dashboard shell                  | Complete                    | 2026-11-04 |
| 5. Properties & estates                          | Complete                    | 2026-11-04 |
| 6. Public website                                | Complete                    | 2026-11-05 |
| 7. Inspections & enquiries                       | Complete, awaiting approval | —          |
| 8. Content management                            | Not started                 | —          |
| 9. Blog                                          | Not started                 | —          |
| 10. Customer accounts                            | Not started                 | —          |
| 11. Marketing, announcements, analytics, consent | Not started                 | —          |
| 12. Testing, security, deployment                | Not started                 | —          |

---

## Stage 7 — Inspections & Enquiries

Owner decisions (2026-11-05):

- The owner asked to continue after reviewing Stage 6, so Stage 6 is treated as approved.
- **No email alerts** for new requests.
- WhatsApp number supplied by the owner: +2348133322772. It is set in the dev `site_settings` and must also be set in production (an editor arrives in Stage 8).

### Completed

- **Inspection request form** on every listed property page (hidden while the property is unavailable):
  - fields: full name, phone (international, Nigeria default; checked on the server with full metadata), optional email;
  - preferred date (today up to 6 months ahead, Lagos time) and time of day, plus a message;
  - an explicit consent checkbox linking to the privacy policy.
- **Confirmation** with a reference number (first 8 characters of the request id) and a "Chat with us on WhatsApp" button, pre-filled with the reference and property, shown when a number is configured. It is remembered on the device for 30 days, so the visitor can reopen the chat; "Make another request" clears it.
- **Contact page** (`/contact`) with a contact form (name, email, optional phone, subject, message, consent). Company phone, email and WhatsApp show only once they are entered in Stage 8.
- **Spam and abuse protection:**
  - honeypot field (bots get a normal-looking reply and nothing is saved);
  - Cloudflare Turnstile (development test keys; the server refuses test keys on production);
  - Postgres rate limits: 5 per hour per connection; 2 per day per phone per property; 3 per hour per email for contact.
  - Rate-limit keys use hashed identifiers.
  - Inserts go through server code only; the tables still have no public INSERT policy.
- **Database rules** (from Stage 3, verified again): the property snapshot is attached by the database, unlisted properties are refused, status always starts as pending, and visitor details can't be changed afterwards.
- **Inspection request handling** (dashboard → Inspections & Enquiries):
  - list with search (name or phone), status filter (open by default) and pagination;
  - detail page with call, WhatsApp and email links; the property as it was when requested; preferred date and time; consent time; whether a customer account is linked;
  - status change with an optional note, recorded in the history timeline with the staff name;
  - staff notes, and delete (needs the delete permission).
- **Contact inbox:**
  - inbox and archive, unread messages in bold, search;
  - opening a message marks it read; reply by email or phone;
  - archive or restore, mark unread, delete.
- **Dashboard overview:** real counts of pending inspection requests and unread messages, limited to what each admin can see.
- **Activity log entries** for status changes and deletions.

### Files created / modified

- Migration: `supabase/migrations/20261105000017_enquiry_workflow.sql`; regenerated types
- Features: `src/features/enquiries/{schemas,server,public-actions,admin,admin-actions}.ts`; `src/features/auth/{otp-core,crypto}.ts` (phone hash)
- Components: `src/components/public/{inspection-form,contact-form,turnstile}.tsx`; `src/components/admin/{enquiry-controls,enquiry-tabs}.tsx`
- Pages:
  - `src/app/(public)/contact/page.tsx`; `src/app/(public)/properties/[slug]/page.tsx` (form);
  - `src/app/admin/(dashboard)/inspections/{page,[id]/page,messages/page,messages/[id]/page}.tsx`;
  - `src/app/admin/(dashboard)/page.tsx` (overview counts);
  - `src/app/sitemap.ts`
- Config: `next.config.ts` (CSP for challenges.cloudflare.com), `.env.local` (Turnstile test keys)
- Tests: `tests/unit/enquiries.test.ts`, `tests/integration/enquiries.test.ts`, `tests/e2e/enquiries.spec.ts`, `tests/e2e/public.spec.ts` (load waits), `tests/e2e/admin-fixtures.ts`, `playwright.config.ts`
- Docs: `docs/security/risk-register.md` (R-021 to R-023)

### Database changes

**0017** (applied to dev):

- `consent_at` on `inspection_requests` and `contact_submissions`;
- status-history notes through `change_inspection_status(id, status, note)`, which runs with the caller's permissions (RLS: inspections:edit);
- an inbox index.

### Tests and results (2026-11-05)

| Check                                                                     | Result                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit tests                                                                | 105 / 105 pass (9 new)                                                                                                                                                                                                                     |
| `npm run test:rls -- --retry=2`                                           | 67 / 68 in the full run; the one failure was DNS (`ENOTFOUND`) inside the test, and it then passed 3 / 3 alone. 8 new enquiry tests pass.                                                                                                  |
| Full `npm run test:e2e -- --retries=2` (final run, very unstable network) | 24 passed, 3 flaky, 1 failed, 2 skipped. Every failed attempt was DNS `ENOTFOUND` or a fail-closed response to it (Turnstile verify / rate-limit check could not reach the network).                                                       |
| Enquiry journeys re-run alone                                             | All 4 pass: inspection request + reopenable confirmation; honeypot saves nothing; staff status change with note in history; contact message to inbox, read on open, archive. The contact journey passed first attempt in its final re-run. |
| `npm run check:secrets`                                                   | Pass (44 client files)                                                                                                                                                                                                                     |
| typecheck / lint / prettier / production build                            | Pass                                                                                                                                                                                                                                       |

### Issues found and fixed during the stage

- Rate-limit keys would have held raw phone numbers and emails: they are now keyed hashes.
- A clock read during rendering (lint): the confirmation is now saved in an effect.
- The Turnstile widget keeps the network busy, so e2e waits now use page load plus the element under test.
- Shared constants exported from a page file: moved into the enquiries module.
- e2e retries were blocked by the real 5-per-hour form limit: tests now reset the enquiry rate limits first.

### Outstanding issues

- **R-021:** real Turnstile keys before launch.
- **R-009:** reset the development database password.
- **R-014:** no email domain yet.
- Customers' own request history appears with customer accounts (Stage 10).
- The privacy policy page linked from the forms is written in Stage 8, flagged for legal review.

---

## Stage 6 — Public Website

Owner: Stage 5 approved, and Stage 6 started 2026-11-04 under the scope agreed in Stage 1. No new decisions were needed.

### Completed

- **Homepage** (`/`):
  - hero with a quick search (location or keyword, type, purpose);
  - featured properties, falling back to the latest listings;
  - "Why choose us" (shown only when items exist).
  - The text comes from `page_sections` (typed in `src/features/content/home-sections.ts`), with neutral defaults and no company claims.
  - Includes WebSite + SearchAction structured data.
- **Property search** (`/properties`):
  - filters live in the URL: keyword (full-text), type, purpose, state, price range, land use, building type, bedrooms, availability;
  - sort by newest or price; 12 per page with pagination;
  - sidebar filters on desktop, and a drawer on mobile;
  - an active-filter list with remove links and "Clear all";
  - loading, empty and no-match states;
  - untrusted URL values are dropped;
  - available listings come first, and unavailable ones stay visible, marked and filterable;
  - filtered URLs are noindex, and canonical URLs are set.
- **Property details** (`/properties/[slug]`):
  - breadcrumb; purpose plus the discount or unavailable label;
  - gallery with a full-screen viewer (keyboard prev/next) and fallback alt text;
  - key details depend on the property type, and empty fields are hidden;
  - formatted description (sanitised again on render), features;
  - click-to-load YouTube (youtube-nocookie);
  - location plus an "Open in Google Maps" link;
  - price panel with instalments; a WhatsApp enquiry button when a WhatsApp number is set in site settings (Stage 8);
  - copy link and WhatsApp share;
  - RealEstateListing + BreadcrumbList structured data, canonical URL, Open Graph image;
  - recently listed properties are prerendered at build time.
- **Organization structured data** on every public page (confirmed facts only: name, URL).
- **`sitemap.xml`** (home, properties, every listing) and **`robots.txt`** (disallows /admin and /design).
- **Caching:** public data is cached (tag `listings`, up to 1 hour). Every dashboard change that affects listings clears it (`updateTag`), and the e2e test confirms that dashboard changes appear immediately.
- **Images:** photos are served through the Next.js image optimiser (AVIF/WebP, responsive sizes). The CSP allows only youtube-nocookie frames and i.ytimg.com thumbnails.
- **Header navigation:** wrapped in Suspense, because the current path is a request-time value under Cache Components.
- **Accessibility:** axe (WCAG 2.1 AA) reports no serious or critical issues on the homepage, search page or a property page.

### Files created / modified

- Features: `src/features/listings/{filters,queries,tags}.ts`, `src/features/content/home-sections.ts`
- Components:
  - `src/components/public/{property-card,property-search-form,listing-filters,listing-controls,property-gallery,youtube-embed,share-buttons,json-ld}.tsx`;
  - `site-header.tsx` / `site-nav.tsx` (Suspense-safe nav)
- Pages: `src/app/(public)/page.tsx` (homepage), `src/app/(public)/properties/page.tsx`, `src/app/(public)/properties/[slug]/page.tsx`, `src/app/(public)/layout.tsx` (Organization data), `src/app/sitemap.ts`, `src/app/robots.ts`
- Dashboard actions now clear the public cache: `src/features/properties/{actions,image-actions,building-type-actions}.ts`
- Config: `next.config.ts` (image remote pattern, YouTube CSP sources); `package.json` (@axe-core/playwright)
- Tests: `tests/unit/listings.test.ts`, `tests/e2e/public.spec.ts`, `tests/e2e/smoke.spec.ts` (mobile filter drawer), `playwright.config.ts`
- Docs: `docs/decisions/ADR-003-not-found-status.md`, `docs/security/risk-register.md` (R-018 to R-020), `README.md`

### Database changes

None.

### Tests and results (2026-11-05)

| Check                                          | Result                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit tests                                     | 96 / 96 pass (7 new: URL filters)                                                                                                                                                                                                                            |
| `npm run test:rls -- --retry=2`                | 60 / 60 pass                                                                                                                                                                                                                                                 |
| Full `npm run test:e2e -- --retries=2`         | **24 passed, 0 failed, 0 flaky**, 2 skipped (device-specific)                                                                                                                                                                                                |
| Public journeys (6 new)                        | Pass: homepage featured + search; URL filters, remove, empty state, hostile params; details, price, gallery, video, JSON-LD; drafts hidden + unavailable marked + dashboard change visible immediately; sitemap/robots; axe WCAG 2.1 AA (0 serious/critical) |
| `npm run check:secrets`                        | Pass (42 client files)                                                                                                                                                                                                                                       |
| typecheck / lint / prettier / production build | Pass                                                                                                                                                                                                                                                         |
| Visual review                                  | Home, search, details at 1440 px and 390 px                                                                                                                                                                                                                  |

### Issues found and fixed during the stage

- `usePathname()` in the header broke prerendering of dynamic routes: the nav is now in Suspense with a static fallback.
- A missing property returned a 200 page. The property is now looked up before rendering, and `generateStaticParams` uses a placeholder because Cache Components needs at least one entry. URLs never built still return 200 with noindex (ADR-003).
- The JSON-LD escaping regex was saved with literal line-separator characters: it now uses character codes.
- A nested `Field` component in the filter form was recreated on each render: it is now a helper function.
- The e2e setup hook needed its own timeout; leftover test listings from a failed attempt were removed.

### Outstanding issues

- **R-009:** reset the development database password.
- **R-014:** no email domain yet.
- Header links to About, Blog and Contact show "not found" until Stages 8 and 9. Latest blog posts on the homepage come with Stage 9.
- The inspection request form on property pages is Stage 7.
- Site-wide company details (phone, WhatsApp, address) are edited in Stage 8. Until then, the WhatsApp enquiry button stays hidden.

---

## Stage 5 — Property & Estate Management

Owner decisions (2026-11-04): Stage 4 approved; Stage 5 plan approved.

- Photos are resized automatically (max 2400 px), converted to WebP and stripped of GPS/EXIF data.
- Descriptions use simple formatted text.
- State is a dropdown of the 36 states plus the FCT.

### Completed

- **Estates:**
  - list showing how many properties each estate has;
  - add and edit, plus internal notes;
  - activate or deactivate;
  - delete, only when the estate has no properties;
  - each estate page lists its properties.
  - Estates are internal only.
- **Separate Land and Building forms**, which share the basics, location, pricing, features, video and SEO sections:
  - **Land:** land use, size and unit (dropdown), dimensions, available plots;
  - **Building:** building type, bedrooms, bathrooms, toilets, parking, optional plot size.
- **Validation** shared by the forms and the CSV import (`src/features/properties/schemas.ts`):
  - a payment period only for rent or lease;
  - land size and unit entered together;
  - during a promotion, the sales price must be below the regular price;
  - states must come from the dropdown;
  - Google Maps links on HTTPS only;
  - YouTube links accepted in every common form;
  - naira amounts typed with commas or ₦.
- **Live discount preview.** The database still computes the stored discount.
- **Formatted descriptions** (TipTap): bold, italic, sub-heading, bullet and numbered lists. HTML is sanitised on the server (sanitize-html allow-list), and plain text is saved for search.
- **Photos:**
  - the browser downscales before upload (fast on mobile data; under Vercel's 4.5 MB limit);
  - the server re-checks size and type, decodes with a pixel limit, re-encodes to WebP at most 2400 px, and drops all metadata;
  - cover photo, reorder (drag, or keyboard-accessible arrow buttons), descriptions for screen readers, delete;
  - at most 30 per property.
- **Status changes:**
  - Draft, Published, Unavailable, Archived;
  - publish and unpublish need the publish permission;
  - publishing needs a price, state, location or city, description and at least one photo;
  - delete needs the delete permission and removes the stored photos.
- **Duplicate review:** flagged properties show the possible match. Only a publisher can mark one "Not a duplicate", and publishing stays blocked until then.
- **Property list:**
  - search across title and location (full-text);
  - filters for status, type and "Needs duplicate review";
  - pagination; featured switch and order; SEO title and description.
- **Building types page:** add new types, or hide types from new properties.
- **CSV bulk import:**
  - separate Land and Building templates (download);
  - uploads up to 500 rows / 2 MB, and the file is never stored;
  - every row gets the same validation as the form;
  - friendly values are accepted ("for sale", "Lagos State", "FCT", "plots", "per annum");
  - estate and building type names must match existing ones;
  - formula-style cells (=, +, @) are rejected;
  - duplicates are flagged both against existing properties (one batch database call) and within the same file;
  - the preview lists errors per row;
  - confirming creates **drafts only**, skipping likely duplicates by default; the import can also be discarded.
- **Activity log entries** for property edits, photos, duplicate review, deletes, estates, building types and imports. Status changes and creation are logged by the database.
- **"No access" page** for sections an admin lacks permission for.

### Files created / modified

- Migrations: `20261104000015_property_management.sql`, `20261104000016_import_duplicate_batch.sql`; regenerated `src/types/database.ts`
- Features:
  - `src/features/properties/{options,links,schemas,row,form-values,media,resize-image,queries,actions,image-actions,building-type-actions}.ts`;
  - `src/features/properties/import/{csv,actions}.ts`;
  - `src/features/estates/actions.ts`
- Lib: `src/lib/rich-text.ts` (server sanitiser), `src/lib/plain-text.ts`, `src/lib/supabase/errors.ts`
- Components:
  - `src/components/admin/{property-form,rich-text-editor,property-images,property-status-controls,estate-form,estate-controls,building-types-manager,import-upload-form,no-access}.tsx`;
  - `src/components/ui/field.tsx` (label id)
- Pages:
  - `src/app/admin/(dashboard)/properties/{page,new/page,new/[kind]/page,[id]/page,building-types/page,import/page,import/[jobId]/page}.tsx`;
  - `properties/import/template/[kind]/route.ts`;
  - `src/app/admin/(dashboard)/estates/{page,new/page,[id]/page}.tsx`
- Config: `next.config.ts` (Server Action body limit 4 MB); `src/app/globals.css` (formatted text styles); `package.json` (@tiptap/react, @tiptap/pm, @tiptap/starter-kit, sanitize-html, papaparse, sharp)
- Tests:
  - `tests/unit/properties.test.ts`;
  - `tests/integration/properties.test.ts`;
  - `tests/integration/helpers.ts` (run-scoped cleanup, `inRolledBackTransaction`);
  - `tests/integration/access-control.test.ts` (super admin guard tested in a rolled-back transaction);
  - `tests/e2e/{properties.spec.ts,session.ts,admin-fixtures.ts}`;
  - `playwright.config.ts`
- Docs: `docs/database.md`, `PROJECT_PROGRESS.md`

### Database changes

- **0015:** Nigerian state check constraint; `description_html` column; `property_listings` view now includes `description_html`; 30-photo limit trigger; `set_property_cover`, `reorder_property_images`, `find_property_duplicate`.
- **0016:** `find_property_duplicates` (batch).
- Both are applied to dev.

### Tests and results (2026-11-04)

| Check                                              | Result                                                                                                                                                     |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests (new)                                   | 40 / 40 pass (properties.test.ts)                                                                                                                          |
| `npm run test:rls -- --retry=2`                    | 60 / 60 pass                                                                                                                                               |
| typecheck / lint / production build                | Pass                                                                                                                                                       |
| Full `npm run test:e2e -- --retries=2` (final run) | 15 passed, 3 flaky (every first attempt failed on DNS `ENOTFOUND`, then passed), 1 skipped (mobile-only), **0 failed**                                     |
| New property journeys (4)                          | Pass: create, photo resized to WebP 2400 px with metadata removed, publish with 20% discount; duplicate review; editor cannot publish; estate + CSV import |
| `npm run check:secrets`                            | Pass (39 client files)                                                                                                                                     |

### Issues found and fixed during the stage

- Every export of a `"use server"` file becomes a callable endpoint, so the row converter was moved to a server-only module.
- The status action now checks permissions before reading the property.
- A duplicate-property relation is ambiguous in the generated types, so it is now fetched separately.
- The Storage API normalises `../` in object names, so traversal can't escape the bucket. The test now checks rejection of unsafe characters instead.
- Owner's real super admin account in dev:
  - the old "last super admin" test demoted a test account and broke a later test;
  - it is now tested inside a rolled-back transaction, and the owner's account was verified untouched.
- Each test file's cleanup could delete another file's accounts while running in parallel: cleanup now removes only its own run's data, plus leftovers over an hour old.
- The "Cover photo" overlay looked like a badge (design rule): it is now plain text.
- e2e locators: required-field labels show an asterisk, and "Description" also matched other fields: tests now use exact accessible names.

### Outstanding issues

- **R-009:** reset the development database password (still open).
- **R-014:** no email domain yet.
- Public property pages (listing, detail, search) are Stage 6; published properties are only visible through the database view for now.
- HEIC photos from iPhones upload in Safari (which can read them) but not in Chrome on Windows; users there should export as JPEG.

---

## Stage 4 — Admin Authentication & Dashboard Foundation

Owner decisions (2026-11-04): Stage 3 and the Stage 4 plan approved; first super admin email
`website4vic@gmail.com` (the Resend account email); no sending domain yet, so email is sent from
`onboarding@resend.dev`, which delivers only to the Resend account owner.

### Completed

- Sign-in with email and password, then a 6-digit emailed code, on every sign-in. Codes:
  - only an HMAC bound to the session is stored;
  - expire after 10 minutes; only the newest code works;
  - can be resent after 60 seconds, up to 5 sends per login;
  - **5 wrong codes in total revoke the login**;
  - the code step must be completed within 30 minutes.
- The same generic error for a wrong password, an unknown email, a non-admin or a deactivated admin.
- Admin sessions last 12 hours at most and end after 30 minutes of inactivity (activity is recorded on each dashboard request). Sign-out revokes the session in the database.
- Forgot password and reset:
  - the response is the same for every email, and the look-up and email happen after the response;
  - the link only works after a button press (so email scanners can't use it up);
  - links are single-use, with a 15-minute marker;
  - completing a reset revokes every admin session and signs the account out everywhere.
- Password policy: 12 to 72 characters, not trivially repetitive.
- Postgres rate limits on sign-in, code verification, code resend, forgot password and link confirmation. The limiter fails closed.
- Security event and activity logging for every auth step. Email addresses and IPs are stored only as keyed hashes; no codes or passwords are logged.
- `src/proxy.ts`: refreshes Supabase cookies on /admin, gives signed-out visitors an optimistic redirect, and sends `Cache-Control: private, no-store`.
- `requireAdmin()` / `requireAdminPermission()` Data Access Layer (`src/features/auth/admin-session.ts`).
- The dashboard is live in production: the menu is filtered by permissions, and it shows the admin's name and role and a sign-out button. The production 404 gate is removed.
- Email through the Resend HTTP API, with branded and escaped templates (code; reset/invite link). The code is not put in the subject. `EMAIL_TRANSPORT=disabled` exists for tests only and is refused on Vercel production.
- `npm run admin:bootstrap` creates the first super admin, with no password and only if none exists yet.
- The daily pg_cron retention purge is scheduled (03:17 UTC).
- **Decision (ADR-002):** a nonce CSP for /admin was rejected, because it is incompatible with Partial Prerendering; the static CSP is kept.

### Files created / modified

- Migration: `supabase/migrations/20261104000014_admin_auth.sql`; regenerated `src/types/database.ts`
- Auth: `src/features/auth/{constants,schemas,redirects,otp-core,crypto,request-meta,security-log,otp-delivery,recovery,admin-session,actions}.ts`
- Email: `src/lib/email/{send,templates}.ts`
- Proxy: `src/proxy.ts`
- Pages: `src/app/admin/(auth)/{layout.tsx, login/*, verify/*, forgot-password/*, reset-password/*, auth/confirm/*}`; `src/app/admin/(dashboard)/layout.tsx`, `page.tsx` (rewritten)
- Components: `src/components/ui/notice.tsx`, `src/components/admin/auth-heading.tsx`
- Script: `scripts/create-first-admin.mjs` (`npm run admin:bootstrap`)
- Tests: `tests/unit/auth.test.ts`, `tests/integration/admin-auth.test.ts`, `tests/integration/helpers.ts` (`sql()` helper), `tests/e2e/admin-auth.spec.ts`, `tests/e2e/admin-fixtures.ts`, `tests/e2e/smoke.spec.ts` (admin now redirects), `playwright.config.ts` (env, disabled email transport, 15 s expect timeout)
- Config/docs: `.env.example` (EMAIL_TRANSPORT, Resend test sender), `.env.local` (whitespace fixed; `ADMIN_OTP_HMAC_SECRET` generated), `package.json`, `src/lib/supabase/server.ts` (comment), `README.md`, `docs/database.md`, `docs/conventions.md`, `docs/security/admin-authentication.md` (new), `docs/security/risk-register.md` (R-002/004/008/012/013 updated; R-014–R-017 added), `docs/decisions/ADR-002-admin-csp.md` (new)

### Database changes

Migration `20261104000014_admin_auth` (applied to dev): table `private.admin_recovery_sessions`; functions `admin_otp_issue`, `admin_otp_verify`, `admin_session_status` (authenticated), `admin_recovery_start/is_valid/complete` (service role only); purge extended; `pg_cron` enabled with job `purge-expired-logs`.

### Tests and results (2026-11-04)

| Check                                              | Result                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit tests                                         | 49 / 49 pass (28 new auth tests)                                                                                                                                                      |
| `npm run test:rls` (live dev API)                  | 51 / 51 pass (33 access-control + 18 new auth tests)                                                                                                                                  |
| Full `npm run test:e2e -- --retries=2` (final run) | 17 pass, 2 flaky, 1 skipped (mobile-only), 1 failed; every failed attempt was a DNS failure (`ENOTFOUND`) or a fail-closed response to one. The failed test passed when re-run alone. |
| Lockout test after race fix                        | 3 / 3 first-attempt passes (single worker)                                                                                                                                            |
| `npm run check:secrets`                            | Pass (32 client files)                                                                                                                                                                |
| typecheck / lint / prettier                        | Pass                                                                                                                                                                                  |
| Supabase Security Advisor                          | Same 3 accepted views (ADR-001); new WARN for `admin_session_status` accepted (R-013); private tables have no policies on purpose                                                     |
| Supabase Performance Advisor                       | INFO only (unused indexes on a new database)                                                                                                                                          |
| Resend key                                         | Verified: test send to `delivered@resend.dev` returned HTTP 200                                                                                                                       |
| Real inbox delivery to website4vic@gmail.com           | **Not yet tested** (happens at owner bootstrap)                                                                                                                                       |

### Issues found and fixed during the stage

- `.env.local` had spaces around `=` (Resend key line, database URL): fixed without printing values.
- Supabase's auth client reads the clock while starting, which Cache Components flagged during runtime prefetch: session reads now call `connection()` first.
- Next.js's route announcer also has `role="alert"`: e2e locators are scoped to our messages.
- The lockout e2e test sometimes typed the next code before React reset the form: it now waits for the reset. (Running `--repeat-each` in parallel also lets one worker's cleanup delete another worker's accounts; use `--workers=1` when repeating auth tests.)
- The code was in the email subject (visible on lock screens): removed.

### Outstanding issues

- **R-009:** reset the development database password (still open from Stage 3).
- **R-014:** only the Resend account owner can receive email until a domain is verified, so no further admins can be invited yet.
- **R-017:** this development network has intermittent DNS failures to Supabase, so e2e runs need retries here.
- Inviting and managing further admins (Admin Users module) is a later stage; the bootstrap script covers the first super admin.
- `/admin/*` section pages (properties, blog, …) are built in Stages 5–11; links currently show 404 after sign-in.

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
