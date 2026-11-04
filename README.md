# Vic Land and Property — Website and Management Platform

Premium real estate website with a separate administrative dashboard.
Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Vercel.

## Documentation

- [Architecture](docs/architecture.md) — approved technical architecture and business rules
- [Design system](docs/design-system.md) — Direction A "Editorial Heritage"
- [Coding conventions](docs/conventions.md)
- [Security risk register](docs/security/risk-register.md)

## Requirements

- Node.js 24 LTS (npm 11)

## Setup

```bash
npm install
cp .env.example .env.local   # fill in development values only
npm run dev                  # http://localhost:3000
```

Development-only pages:

- `/design` — every design-system component and state
- `/admin` — dashboard shell preview (until authentication lands in Stage 4)

Both return 404 in production builds.

## Scripts

| Command                       | Purpose                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- |
| `npm run dev`                 | Development server                                                        |
| `npm run build` / `npm start` | Production build and server                                               |
| `npm run lint`                | ESLint                                                                    |
| `npm run typecheck`           | TypeScript (no emit)                                                      |
| `npm run format`              | Prettier                                                                  |
| `npm test`                    | Unit tests (Vitest)                                                       |
| `npm run test:e2e`            | End-to-end tests (Playwright, against a production build)                 |
| `npm run check:secrets`       | Scan the client bundle for server-only variable names (run after a build) |

## Environments

Development and production use separate Supabase projects. Never commit `.env*` files other than
`.env.example`. Production secrets are configured in Vercel only.
