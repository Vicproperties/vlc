import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck,
  Cookie,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutTemplate,
  Map,
  Megaphone,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Admin sidebar definition. `module` maps to the permission matrix (Stage 3/4);
 * items the current admin cannot view will be filtered out on the server.
 */
export type AdminModule =
  | "overview"
  | "properties"
  | "estates"
  | "inspections"
  | "blog"
  | "content"
  | "marketing"
  | "media"
  | "settings"
  | "admins"
  | "analytics"
  | "cookies"
  | "activity_logs";

export interface AdminNavItem {
  label: string;
  href: string;
  module: AdminModule;
  icon: LucideIcon;
  children?: Array<{ label: string; href: string }>;
}

export const adminNav: AdminNavItem[] = [
  { label: "Overview", href: "/admin", module: "overview", icon: LayoutDashboard },
  {
    label: "Properties",
    href: "/admin/properties",
    module: "properties",
    icon: Building2,
    children: [
      { label: "All Properties", href: "/admin/properties" },
      { label: "Add Property", href: "/admin/properties/new" },
      { label: "Drafts", href: "/admin/properties?status=draft" },
      { label: "Published", href: "/admin/properties?status=published" },
      { label: "Archived", href: "/admin/properties?status=archived" },
      { label: "Bulk Import", href: "/admin/properties/import" },
    ],
  },
  { label: "Estates", href: "/admin/estates", module: "estates", icon: Map },
  { label: "Inspections & Enquiries", href: "/admin/inspections", module: "inspections", icon: CalendarCheck },
  { label: "Blog", href: "/admin/blog", module: "blog", icon: FileText },
  {
    label: "Website Content",
    href: "/admin/content",
    module: "content",
    icon: LayoutTemplate,
    children: [
      { label: "Home", href: "/admin/content/home" },
      { label: "About", href: "/admin/content/about" },
      { label: "Contact", href: "/admin/content/contact" },
      { label: "FAQ", href: "/admin/content/faq" },
      { label: "Team", href: "/admin/content/team" },
      { label: "Privacy Policy", href: "/admin/content/privacy-policy" },
      { label: "Terms & Conditions", href: "/admin/content/terms" },
    ],
  },
  {
    label: "Marketing",
    href: "/admin/marketing",
    module: "marketing",
    icon: Megaphone,
    children: [
      { label: "Announcement Modal", href: "/admin/marketing/announcements" },
      { label: "Top Banner", href: "/admin/marketing/banner" },
      { label: "Property Promotions", href: "/admin/marketing/promotions" },
      { label: "Newsletter Subscribers", href: "/admin/marketing/newsletter" },
    ],
  },
  { label: "Media Library", href: "/admin/media", module: "media", icon: ImageIcon },
  { label: "Website Settings", href: "/admin/settings", module: "settings", icon: Settings },
  { label: "Admin Users", href: "/admin/admins", module: "admins", icon: ShieldCheck },
  { label: "Visitor Analytics", href: "/admin/analytics", module: "analytics", icon: BarChart3 },
  { label: "Cookie Management", href: "/admin/cookies", module: "cookies", icon: Cookie },
  { label: "Activity Logs", href: "/admin/activity", module: "activity_logs", icon: Activity },
];
