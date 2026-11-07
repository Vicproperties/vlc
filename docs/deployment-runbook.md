# Deployment runbook

How the live site is built, deployed and changed. Audience: the developer looking after the site.

## Environments

| Environment | Website                        | Supabase project                       | Used by                                    |
| ----------- | ------------------------------ | -------------------------------------- | ------------------------------------------ |
| Live        | https://viclandandproperty.com | `vlc-dev` (tcfpnbliwjlinwlgzmkc)       | Vercel production (vlc-land-and-property)  |
| Test        | http://localhost:3000 / 3100   | `Test-database` (ncgtfridrpmcwgojpgix) | Local development and every automated test |

- The live project keeps its historical name `vlc-dev`; it **is** the live database.
- `.env.local` points at the **test** project. `SUPABASE_LIVE_DB_URL` in it is the live database connection, used only by `npm run db:push:live`.
- `.env.live.local` is a copy of the live settings, for reference. `.env*` files are never committed.
- `tests/integration/helpers.ts` refuses to run unless the Supabase URL is the test project.
- Live environment variables live in Vercel → Project → Settings → Environment Variables (Production). Never print them; add with `npx vercel env add NAME --environment production`.

## Normal release

1. Work on a branch or on `main` locally. Run checks:
   `npm run typecheck && npm run lint && npm run format:check && npm test`
2. Database changes: add a new file in `supabase/migrations/` (never edit an applied one), then
   `npm run db:push` (test project) and `npm run test:rls`.
3. Browser tests: `npm run test:e2e` (builds, then runs Playwright against the test project). The owner's network drops DNS often; use `--retries=2`.
4. Push to GitHub `main`. GitHub Actions runs the checks; Vercel builds and deploys automatically (about 2 minutes).
5. If the release has a migration, apply it to live **after owner approval**:
   `npm run db:push:live:dry` (shows what will run), then `npm run db:push:live`.
   Apply the migration before pushing code that depends on it.
6. Regenerate types from live after a migration: `npm run db:types`.
7. Check the live site: home, a property, a blog article, `/admin/login`.

## Rollback

- **Code:** Vercel → Deployments → pick the previous Ready deployment → _Promote to Production_ (or `npx vercel rollback`). Then revert the commit on `main` so the next push doesn't redeploy it.
- **Database:** migrations are forward-only. Write a new migration that undoes the change. Data loss can only be recovered from backups, which need Supabase Pro (see the launch checklist).

## Troubleshooting

- **Runtime errors:** `npx vercel logs --query 'environment:production' --since 1h --json`. The Hobby plan keeps logs about one hour, so read them soon after a failure.
- Image upload failures log `[images] re-encode failed` or `[content] section image upload failed`.
- **"Blocking prerender" / NEXT_STATIC_GEN_BAILOUT build errors:** a page read params, cookies or the pathname outside `<Suspense>` (see ADR-003).
- **Admin cannot sign in:** check the Supabase and email env vars in Vercel, then the Resend dashboard for the code email.

## Scheduled job

`vercel.json` runs `/api/cron/purge-analytics` daily at 02:30 UTC. It does nothing until `CRON_SECRET` is set in Vercel (R-028).
