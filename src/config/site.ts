/**
 * Static site configuration.
 *
 * Company details (name, contacts, social links, hours) move to the `site_settings`
 * table in Stage 8 and become editable from the dashboard. Until then only the
 * company name (official form "V.I.C Land and Property", owner brief 2026-11-09) is defined here.
 */
export const siteConfig = {
  name: "V.I.C Land and Property",
} as const;

export interface NavItem {
  label: string;
  href: string;
}

export const publicNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Properties", href: "/properties" },
  { label: "About", href: "/about" },
  { label: "Team", href: "/team" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const legalNav: NavItem[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];

/**
 * Live chat (Tawk.to, owner decision 2026-11-10). Public IDs from Tawk.to → Administration →
 * Chat Widget (the two parts of https://embed.tawk.to/<propertyId>/<widgetId>). The chat button
 * is hidden while these are empty.
 */
export const liveChat = {
  propertyId: "6af2c814aeb7363c46bc3027",
  widgetId: "1k725r4d9",
} as const;
