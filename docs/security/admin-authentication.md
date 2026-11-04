# Admin Authentication

How dashboard sign-in works and where each rule is enforced. Code: `src/features/auth/`,
`src/proxy.ts`, migration `20261104000014_admin_auth.sql`.

## Sign-in

1. **Password** (`/admin/login`). Supabase Auth checks the password. Wrong passwords, unknown
   emails, customers and deactivated admins all get the same message:
   "The email or password is incorrect."
2. **Admin session.** The server creates an unverified `private.admin_sessions` row bound to
   the Auth session (`session_id` in the JWT). It expires after 12 hours, whatever happens.
3. **Emailed code** (`/admin/verify`). It's a random 6-digit code. Only
   `HMAC(ADMIN_OTP_HMAC_SECRET, session_id:code)` is stored, so a code can't be used for any
   other login.
   - Each code expires after 10 minutes, and only the newest one works.
   - A new code can be requested after 60 seconds, up to 5 per login.
   - **5 wrong codes in total revoke the login.** The admin must enter the password again.
   - The code step must be completed within 30 minutes.
4. **Dashboard.** Each request calls `admin_session_status()`, which checks the JWT's own
   session and records activity. A session ends after **30 minutes of inactivity**.

## Where it is enforced

| Layer                                         | Role                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/proxy.ts`                                | Refreshes cookies; redirects signed-out visitors (convenience only)                     |
| `requireAdmin()` / `requireAdminPermission()` | Server check in every dashboard page and Server Action                                  |
| Postgres RLS (`has_admin_permission`)         | Final authority: no verified session, no data, even if application code forgets a check |

A sub-admin's sidebar shows only the modules they can view. Hiding is for convenience;
access is still enforced by the two layers below it.

## Password reset

- `/admin/forgot-password` always gives the same answer. The look-up and the email happen
  after the response (`after()`), so response time doesn't reveal whether an account exists.
- The emailed link opens `/admin/auth/confirm`, which only uses the token when the person
  presses **Continue** (a POST). This stops email security scanners using the link up.
- The link creates a 15-minute recovery marker for that session. Saving a new password:
  - revokes every admin session of the account;
  - signs the account out everywhere (`signOut({ scope: "global" })`);
  - still requires the emailed code at the next sign-in.
- Passwords must be 12 to 72 characters (72 is bcrypt's limit) and not trivially repetitive.

## Rate limits (Postgres, fixed window)

| Action                 | Limit                                      |
| ---------------------- | ------------------------------------------ |
| Sign-in                | 5 per email and 20 per network, per 15 min |
| Code verification      | 10 per login, per 15 min                   |
| New code requests      | 6 per login, per 30 min                    |
| Forgot password        | 3 per email and 10 per network, per hour   |
| Opening password links | 10 per network, per hour                   |

The limiter fails closed: if the check can't run, the request is refused. Network
addresses and emails are stored only as keyed hashes.

## Logging

`security_events`:

- sign-in failures, refusals and rate limits;
- codes sent, failed and locked;
- sign-ins and sign-outs;
- password reset requests and completions;
- email delivery failures.

`activity_logs`: `admin.login` and `admin.password_reset`.

Logs never contain passwords, codes, tokens or raw IP addresses.

## First super administrator

```
npm run admin:bootstrap -- --email you@example.com --name "Your Name"
```

This creates the account without a password, and it refuses to run if a super admin
already exists. Then open `/admin/forgot-password`, enter the same email, and set the
password from the emailed link.

## Email

`src/lib/email/send.ts` sends through the Resend API. Until a sending domain is verified,
`EMAIL_FROM` is `onboarding@resend.dev`, and Resend then only delivers to the Resend account's
own address. Automated tests use `EMAIL_TRANSPORT=disabled`, which is refused on Vercel
production.
