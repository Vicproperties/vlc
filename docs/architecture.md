# Architecture

Status: approved (Stage 1, 2026-11-03). Update this document whenever an agreed decision changes.

## 1. Overview

A single Next.js (App Router, TypeScript) application deployed on Vercel, backed by Supabase
(Postgres, Auth, Storage). It serves two experiences:

- **Public website** — `/`, `/properties`, `/properties/[slug]`, `/about`, `/blog`, `/blog/[slug]`,
  `/contact`, `/privacy-policy`, `/terms-and-conditions`, plus optional customer area `/account/*`.
- **Admin dashboard** — `/admin/*`. Base URL is configurable (`NEXT_PUBLIC_ADMIN_BASE_URL`) so it can
  move to a subdomain later without code changes.

There are no public estate pages and no standalone inspection page.

## 2. Principles

1. Server Components by default; client components only for interactivity.
2. All mutations go through Server Actions / Route Handlers that validate with Zod, authorize on the
   server, then hit Postgres under the caller's JWT so Row Level Security applies.
3. Defence in depth: server authorization checks **and** RLS. UI hiding is never a control.
4. The Supabase service-role client is only used in a small number of `server-only` modules.
5. Public pages are cached with tag-based revalidation; admin pages are always dynamic.
6. No fabricated business content. Empty data renders an empty state or nothing.

## 3. Business rules (agreed)

| Topic               | Rule                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Market              | Nigeria. Currency NGN, stored as whole naira. Privacy text must consider NDPA 2023 (flag for legal review).                                                                                 |
| Phone numbers       | International numbers accepted; Nigeria (+234) is the default country. Stored in E.164.                                                                                                     |
| Property kind       | `land` or `building`. Title and kind are required; everything else optional.                                                                                                                |
| Transaction purpose | Exactly one of `sale`, `rent`, `lease`. Same property for sale and lease = two listings.                                                                                                    |
| Price period        | Optional `per_week`, `per_month`, `per_year`; only allowed for rent/lease.                                                                                                                  |
| Pricing display     | Main price = sales price, else regular price. Struck-through regular price and discount shown only when promotion is active and `0 < sales < regular`. Discount is computed, never entered. |
| Land use            | Optional for land: `residential`, `commercial`, `agricultural`.                                                                                                                             |
| Land size           | Numeric value + unit from a fixed list: `sqm`, `plot`, `acre`, `hectare`. Both or neither. No automatic unit conversion (plot sizes vary by location).                                      |
| Statuses            | `draft`, `published`, `unavailable`, `archived`. Public sees `published` and `unavailable` (clearly labelled, filterable).                                                                  |
| Duplicates          | Flagged automatically; flagged properties cannot be published until reviewed.                                                                                                               |
| Estates             | Internal only. Optional association. Imports must match existing estate names.                                                                                                              |
| Inspections         | Saved first; WhatsApp click-to-chat offered afterwards via a user-initiated button.                                                                                                         |
| Newsletter          | Double opt-in.                                                                                                                                                                              |
| Blog authors        | Separate `blog_authors` table (authors need not be admins).                                                                                                                                 |
| Analytics           | First-party at launch. Google Analytics optional later, behind analytics consent.                                                                                                           |

## 4. Identity

- **Customers:** Google OAuth via Supabase Auth only. Profile in `customer_profiles`.
- **Admins:** email + password, then a custom email OTP on every login. Admin status lives in
  `admin_users` (server-controlled). RLS helper `is_verified_admin()` requires an active admin **and**
  an OTP-verified, unrevoked `admin_sessions` row for the JWT `session_id`.
- Admin accounts must use the email provider; Google identities are refused at admin login.
- No admin self-registration; super admins create admins. First super admin via a local CLI script.
- Password reset: Supabase PKCE recovery link, generic response regardless of email existence,
  global sign-out and admin session revocation afterwards.
- Proposed session policy: 30 min idle, 12 h absolute for admins.

## 5. Data model (summary)

Identity/security: `admin_users`, `admin_permissions`, `admin_sessions`, `admin_otp_challenges`,
`rate_limits`, `activity_logs` (append-only), `security_events` (append-only), `customer_profiles`.

Properties: `estates`, `properties` (single table, `kind` discriminator, CHECK constraints for
kind-specific columns, generated `discount_percent`, `effective_price`, `search_vector`),
`property_images`.

Enquiries: `inspection_requests` (with `property_snapshot`), `inspection_status_history`,
`contact_submissions`, `favourites`, `newsletter_subscribers`.

Blog: `blog_categories`, `blog_authors`, `blog_posts` (TipTap JSON source + sanitized HTML).

Content/marketing: `site_settings` (singleton), `page_sections` (typed JSON per section, validated by
Zod), `core_values`, `why_choose_us_items`, `team_members`, `faqs`, `legal_pages`, `announcements`,
`top_banners`, `cookie_settings`, `cookie_consents`, `media_assets`.

Imports/analytics: `import_jobs`, `import_rows`, `analytics_sessions`, `analytics_events`
(~90 day raw retention), `analytics_daily` (rollups via pg_cron).

## 6. Storage

| Bucket           | Access                          | Use                                         |
| ---------------- | ------------------------------- | ------------------------------------------- |
| `property-media` | public read, permissioned write | property images                             |
| `blog-media`     | public read, permissioned write | article images                              |
| `site-media`     | public read, permissioned write | team, announcements, OG images              |
| `imports`        | private                         | CSV / DOCX during processing (auto-cleanup) |

Uploads go directly from the browser to Supabase via server-issued signed upload URLs (avoids the
Vercel request body limit), then the server verifies type/size and registers the asset.

## 7. Environments

- Development: separate free Supabase project. Production: Supabase Pro.
- Credentials never shared between environments. Production secrets live only in Vercel.
- Migrations live in `supabase/migrations` and are applied to development first.

## 8. Design system

Direction A — "Editorial Heritage". See `docs/design-system.md`.

## 9. Stage plan

1. Planning (done) · 2. Setup & design system · 3. Database & security foundation ·
2. Admin auth & dashboard shell · 5. Properties & estates · 6. Public website ·
3. Inspections & enquiries · 8. Content management · 9. Blog · 10. Customer accounts ·
4. Marketing, announcements, analytics, consent · 12. Testing, security, deployment.
