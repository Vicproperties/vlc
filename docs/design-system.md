# Design System — V.I.C Land and Property

Current direction: **premium modern** (owner brief 2026-11-09), replacing the original "Editorial
Heritage" direction (2026-11-03) and the first rounded redesign (2026-11-06). Tokens live in
`src/app/globals.css` (`@theme`). Components live in `src/components/ui` and `src/components/public`.

## Principles

White space first · strong type hierarchy · rounded cards (1.5–2.5rem) with one squared corner as a
signature · thin concentric **rings** (`Rings`) as the only decorative motif · soft purple-tinted
shadows on cards · no gradients · real content only (no stock photos presented as the
company's, no invented figures) · the official name is always **V.I.C Land and Property**
(`siteConfig.name`).

## Colour

Brand foundation: **White #FFFFFF**, **Russian Purple #32174D** (primary), **Soft Lavender #D8CBE3**
(secondary). Neutrals support text and borders. Contrast figures are approximate.

| Token         | Hex       | Use                                                    | Contrast         |
| ------------- | --------- | ------------------------------------------------------ | ---------------- |
| `paper`       | `#FFFFFF` | Page background (White)                                | —                |
| `surface`     | `#FAF7FC` | Panels, inputs, admin surfaces                         | —                |
| `ink`         | `#1C1824` | Headings and body text                                 | ≈17:1 on white   |
| `stone`       | `#5D5768` | Secondary text                                         | ≈6.8:1 on white  |
| `line`        | `#ECE5F2` | Hairlines                                              | —                |
| `line-strong` | `#CDBFDB` | Input borders                                          | —                |
| `brand`       | `#32174D` | Russian Purple: buttons, links, focus, dark sections   | ≈16:1 with white |
| `brand-deep`  | `#241038` | Hover/pressed, footer                                  | —                |
| `brand-mid`   | `#5A3A7E` | Eyebrows and icons on white or lavender                | ≈9:1 on white    |
| `brand-light` | `#D8CBE3` | Soft Lavender: accents, panels, text on Russian Purple | ≈10:1 on `brand` |
| `brand-tint`  | `#F3EEF7` | Soft section backgrounds, chips                        | —                |
| `danger`      | `#8E2A21` | Errors, destructive actions                            | —                |
| `success`     | `#2F5D3F` | Success messages                                       | —                |
| `warning`     | `#7A5A12` | Warnings                                               | —                |

Because `brand` is close to `ink`, links always carry an underline or an arrow icon.

## Building blocks (public site)

- `PageHero`, `SectionHeading`, `Eyebrow`, `Rings` — `components/public/page-hero.tsx`.
- Buttons: `primary`, `secondary`, `inverse` and `outline-light` (the last two on purple).
- `TeamCard`, `TeamGrid`, `CeoSection` — `components/public/team.tsx`; `SocialLinks` — `social-icons.tsx`.
- Scroll reveal: add `data-reveal` (fade and rise), `data-reveal="image"` (image wipe) or
  `data-reveal-stagger` (children one after another). `ScrollReveal` in the public layout runs it;
  content is never hidden without JavaScript or with reduced motion.
- Live chat button (`LiveChat`) fixed bottom right; Tawk.to loads only on click.

## Typography

- Display / headings: **Hanken Grotesk** 700, tracking -0.025em (Newsreader removed 2026-11-06).
- Body / interface: **Hanken Grotesk**, weights 400, 500, 600.
- Labels / eyebrows: `Eyebrow` — Hanken Grotesk 600, 12px, uppercase, `tracking-[0.16em]`, `brand-mid` (or `brand-light` on purple), with a short rule.
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
