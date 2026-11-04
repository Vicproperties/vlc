# Design System — Direction A "Editorial Heritage"

Approved 2026-11-03. Tokens live in `src/app/globals.css` (`@theme`). Components live in `src/components/ui`.
Preview every component and state at `/design` (development only; 404 in production).

## Rules (non-negotiable)

No emojis · no gradients · no badges or pills · radius 0–2px · shadows only on overlays (dialogs,
drawers, menus) · no decorative animation · transitions 150–250ms on colour/opacity/transform only ·
generous white space · one accent colour.

## Colour

| Token         | Hex       | Use                                        |
| ------------- | --------- | ------------------------------------------ |
| `paper`       | `#F6F4EF` | Page background                            |
| `surface`     | `#FCFBF8` | Raised areas (forms, tables, admin panels) |
| `ink`         | `#1B1B19` | Primary text, primary buttons on light     |
| `stone`       | `#6E6A62` | Secondary text (AA on paper and surface)   |
| `line`        | `#DDD8CE` | Hairline borders and rules                 |
| `line-strong` | `#BFB8AA` | Input borders, emphasised dividers         |
| `forest`      | `#1F3A2E` | Accent: primary actions, links, focus      |
| `forest-deep` | `#152820` | Accent hover/pressed                       |
| `forest-tint` | `#E6EAE5` | Selected rows, subtle accent backgrounds   |
| `danger`      | `#8E2A21` | Errors, destructive actions                |
| `success`     | `#2F5D3F` | Success messages                           |
| `warning`     | `#7A5A12` | Warnings                                   |

Status text (dashboard) uses coloured text with a 6px square marker, never a pill.

## Typography

- Display / headings: **Newsreader** (serif, optical sizing), weights 400–500. Tight leading, slight negative tracking at large sizes.
- Body / interface: **Hanken Grotesk**, weights 400, 500, 600.
- Labels / eyebrows: Hanken Grotesk 500, 12px, uppercase, `tracking-[0.14em]`, `stone`.
- Fonts are self-hosted through `next/font` (no runtime requests to Google).

| Token     | Size / line-height   | Family     |
| --------- | -------------------- | ---------- |
| `display` | 56–80px fluid / 1.02 | Newsreader |
| `h1`      | 40–56px fluid / 1.08 | Newsreader |
| `h2`      | 32–40px fluid / 1.15 | Newsreader |
| `h3`      | 24px / 1.25          | Newsreader |
| `h4`      | 18px / 1.35          | Hanken 600 |
| `body-lg` | 18px / 1.65          | Hanken     |
| `body`    | 16px / 1.6           | Hanken     |
| `small`   | 14px / 1.5           | Hanken     |
| `caption` | 12px / 1.4           | Hanken     |

Admin uses Hanken only, base 14px.

## Spacing and layout

4px base unit. Section padding: 96–160px desktop, 64–96px mobile. Content max width 1280px with 24px
(mobile) / 40px (tablet) / 64px (desktop) gutters. Reading width for prose: 68ch.

## Components

Button (primary, secondary, quiet, link, danger; sm/md/lg; loading state) · Input · PasswordInput
(eye / eye-off toggle, `aria-pressed`, keyboard accessible) · Textarea · Select · Checkbox · Radio ·
FormField (label, hint, error, required marker) · PhoneInput (country + number, defaults to Nigeria) ·
Dialog · Drawer · Tabs · Table · Pagination · Toast · Skeleton · EmptyState · ErrorState · Price
(naira, period, strike-through regular price, discount label) · Container · Eyebrow · Rule.
