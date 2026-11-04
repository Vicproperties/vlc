/**
 * Static site configuration.
 *
 * Company details (name, contacts, social links, hours) move to the `site_settings`
 * table in Stage 8 and become editable from the dashboard. Until then only the
 * company name (confirmed by the owner 2026-11-04) is defined here.
 */
export const siteConfig = {
  name: "Vic Land and Property",
} as const;

export interface NavItem {
  label: string;
  href: string;
}

export const publicNav: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Properties", href: "/properties" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const legalNav: NavItem[] = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];
