# ADR-001: Public read models as owner-privileged views

Status: Accepted (Stage 3, 2026-11-04)

## Context

`public.properties` contains internal columns (estate association, duplicate review, audit
fields) and is readable only by authorised admins. Visitors and customers must still read
listed properties, and customers must read their own inspection requests without admin notes.

Postgres row security cannot hide individual columns per user, and customers and admins share
the `authenticated` role, so column privileges cannot separate them either.

## Decision

Expose public data through views that run with the owner's privileges
(`security_invoker = false`, plus `security_barrier = true`):

| View                      | Access rule (WHERE clause)              | Exposed to          |
| ------------------------- | --------------------------------------- | ------------------- |
| `property_listings`       | `status in ('published','unavailable')` | anon, authenticated |
| `property_listing_images` | parent property listed                  | anon, authenticated |
| `my_inspection_requests`  | `customer_id = auth.uid()`              | authenticated       |

Each view selects an explicit column list that excludes internal fields.

## Consequences

- The Supabase Security Advisor reports `security_definer_view` (ERROR level) for these three
  views. This is expected and accepted. The lint exists to catch views that bypass RLS by
  accident; here the bypass is deliberate and the WHERE clause is the access rule.
- Any new column added to these views must be reviewed for public safety.
- The rules are verified by `tests/integration/access-control.test.ts` (drafts never visible,
  customers see only their own requests, no `admin_notes`).
- Re-evaluate if Postgres/Supabase gains per-column row security or if requirements change.
