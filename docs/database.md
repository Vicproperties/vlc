# Database Reference

Supabase Postgres. Schema is defined only by migrations in `supabase/migrations/` — never
edit the database by hand. Development project: `tcfpnbliwjlinwlgzmkc` (eu-central-1).

## Workflow

| Command                    | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `npm run db:push:dry`      | Show migrations that would be applied to the dev database           |
| `npm run db:push -- --yes` | Apply pending migrations to the dev database                        |
| `npm run db:types`         | Regenerate `src/types/database.ts` from the live schema             |
| `npm run test:rls`         | Access-control integration suite (dev project only; refuses others) |

Rules: one change = one new migration file (never edit an applied migration); regenerate
types after every migration; run `test:rls` before committing.

All commands read `.env.local` through `scripts/with-env.mjs`, which redacts secret values from
output. Never `source` `.env` files in a shell.

## Schemas

- `public` — application tables, exposed through the Data API (every table has RLS).
- `private` — helper functions and tables that must never be reachable by the API:
  `admin_sessions`, `admin_otp_challenges`, `rate_limits`.

## Roles and access

| Role            | Who                      | Access                                                                    |
| --------------- | ------------------------ | ------------------------------------------------------------------------- |
| `anon`          | Visitors                 | Public views and visible content only                                     |
| `authenticated` | Customers **and** admins | Own customer data; admin powers only via `private.has_admin_permission()` |
| `service_role`  | Trusted server code      | Bypasses RLS. Form submissions, analytics, admin management, imports      |

`private.is_verified_admin()` = active `admin_users` row **and** an `admin_sessions` row for the
JWT `session_id` that is OTP-verified, unrevoked, unexpired and active within 30 minutes.

`private.has_admin_permission(module, action)` = verified admin and (super admin or matching
`admin_permissions` flag). Modules: properties, estates, inspections, enquiries, blog, content,
marketing, newsletter, customers, media, settings, admins, analytics, cookies, activity_logs.
Actions: view, create, edit, publish, delete.

## Tables

| Area                | Tables                                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity & security | `admin_users`, `admin_permissions`, `activity_logs`, `security_events`, `customer_profiles`; private: `admin_sessions`, `admin_otp_challenges`, `rate_limits`                                                               |
| Properties          | `estates`, `building_types` (seeded list), `properties`, `property_images`                                                                                                                                                  |
| Enquiries           | `inspection_requests`, `inspection_status_history`, `contact_submissions`, `favourites`, `newsletter_subscribers`                                                                                                           |
| Blog                | `blog_categories`, `blog_authors`, `blog_posts`                                                                                                                                                                             |
| Content & marketing | `site_settings` (singleton), `page_sections`, `core_values`, `why_choose_us_items`, `team_members`, `faqs`, `legal_pages`, `announcements`, `top_banners`, `cookie_settings` (singleton), `cookie_consents`, `media_assets` |
| Imports & analytics | `import_jobs`, `import_rows`, `analytics_sessions`, `analytics_events`, `analytics_daily`                                                                                                                                   |

Public read views (see ADR-001): `property_listings`, `property_listing_images`, `my_inspection_requests`.

## Rules enforced by the database

- **Properties:** land-only / building-only fields by kind; `price_period` only for rent/lease;
  `land_size` + `land_size_unit` together; `discount_percent` and `effective_price` are generated;
  slugs generated and unique; audit columns (`created_by`, `updated_by`) cannot be forged.
- **Publishing:** changing status to/from `published` requires `properties:publish`
  (`blog:publish` for articles), checked in triggers so it cannot be bypassed via the API.
- **Duplicates:** likely duplicates (title/location similarity, same kind and size) are
  `flagged` automatically; flagged properties cannot be published; only a publisher can move
  `flagged → cleared`; nobody can reset a flag to `none`.
- **Inspections:** property snapshot and link are attached by the database; status always
  starts `pending`; submitter fields are immutable afterwards; status history is recorded.
- **Admins:** the last active super admin cannot be removed, demoted or deactivated (direct-DB
  maintenance override only, migration 0010).
- **Logs:** append-only for everyone including the service role; only
  `private.purge_expired_logs()` deletes rows past retention (activity 2 years, security 1 year).
  Logs keep the actor id and email after the account is deleted.

## Storage buckets

| Bucket           | Public | Types                 | Max size | Write permission                              |
| ---------------- | ------ | --------------------- | -------- | --------------------------------------------- |
| `property-media` | yes    | JPEG, PNG, WebP, AVIF | 10 MB    | properties create/edit, media create          |
| `blog-media`     | yes    | JPEG, PNG, WebP, AVIF | 10 MB    | blog create/edit, media create                |
| `site-media`     | yes    | JPEG, PNG, WebP, AVIF | 10 MB    | content/marketing/settings edit, media create |
| `imports`        | no     | CSV, DOCX             | 20 MB    | properties/blog create; uploader-only read    |

SVG is not accepted. Object names are restricted to `[a-z0-9/_.-]` with no traversal.

## Retention

Raw analytics 90 days (Stage 11 job) · security events 1 year · activity logs 2 years ·
OTP challenges and rate-limit counters 1 day · expired admin sessions 30 days.
Scheduling of `private.purge_expired_logs()` (pg_cron) is set up in Stage 4.
