# ADR-003: Missing property pages return "not found" content with noindex

Status: Accepted (Stage 6, 2026-11-05)

## Context

Property pages (`/properties/[slug]`) use Cache Components with Partial Prerendering.
Recently listed properties are prerendered at build time. Other addresses get the route's
static shell immediately, and the property is looked up after that. By then the HTTP status
(200) has already been sent, so a missing, draft or archived property cannot return a 404
status. The Next.js 16 docs describe this as inherent to streaming.

The only way to get a real 404 for those addresses would be a database check in the proxy
before every property page view. That adds a database round trip to each view and bypasses
the page cache.

## Decision

Keep the cached pages. When a property does not exist or is not listed:

- the page renders the site's "Page not found" content, with no property data;
- Next.js adds `<meta name="robots" content="noindex">`, so search engines drop the URL;
- addresses prerendered at build time that are later unpublished render not-found the same way
  once the "listings" cache tag is cleared, which happens immediately from the dashboard.

## Consequences

- Monitoring tools that rely only on status codes will see 200 for these URLs.
- Verified by `tests/e2e/public.spec.ts`: drafts are never visible, and the not-found page
  carries noindex.
- Re-evaluate if Next.js adds status control for this case, or if SEO tooling flags soft 404s.

## Update (Stage 11, 2026-11-06)

The page read the address (`params`) outside `<Suspense>`. First visits worked, but after a
listing changed (cache tag cleared) Next.js could not rebuild the route in the background
("blocking prerender", `NEXT_STATIC_GEN_BAILOUT`), so visitors could keep seeing an outdated
page, for example without a new promotion price. The address is now read inside
`<Suspense>` with a loading placeholder. The not-found behaviour above is unchanged and
still covered by `public.spec.ts`; `marketing.spec.ts` covers "change a listing after its
page was built, then view it".
