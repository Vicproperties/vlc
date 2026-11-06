import type { Database } from "@/types/database";

/**
 * Admin Users: which dashboard sections a sub-admin can be given, and which actions each
 * section actually uses. Shared by the form (client) and the server actions, so a tick the
 * form does not show can never be saved. Super admins have every permission implicitly.
 *
 * "admins" is deliberately absent: only super admins manage administrators. Sections not
 * built yet (marketing, media, analytics, cookies, activity logs) are added when they are.
 */
export type AdminModuleName = Database["public"]["Enums"]["admin_module"];
export type PermissionAction = "view" | "create" | "edit" | "publish" | "delete";
export type PermissionSet = Partial<Record<AdminModuleName, Partial<Record<PermissionAction, boolean>>>>;

export const PERMISSION_ACTIONS: ReadonlyArray<{ key: PermissionAction; label: string }> = [
  { key: "view", label: "View" },
  { key: "create", label: "Add" },
  { key: "edit", label: "Edit" },
  { key: "publish", label: "Publish" },
  { key: "delete", label: "Delete" },
];

export const MANAGED_MODULES: ReadonlyArray<{
  module: AdminModuleName;
  label: string;
  hint: string;
  actions: ReadonlyArray<PermissionAction>;
}> = [
  {
    module: "content",
    label: "Website content",
    hint: "Home, About, Contact, FAQ, Team, Privacy Policy and Terms pages.",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "blog",
    label: "Blog",
    hint: "Publish puts articles live without a super admin. Delete also covers comments once they exist.",
    actions: ["view", "create", "edit", "publish", "delete"],
  },
  {
    module: "properties",
    label: "Properties",
    hint: "Listings, photos, bulk import and building types.",
    actions: ["view", "create", "edit", "publish", "delete"],
  },
  {
    module: "estates",
    label: "Estates",
    hint: "Internal groupings of properties.",
    actions: ["view", "create", "edit", "delete"],
  },
  {
    module: "inspections",
    label: "Inspection requests",
    hint: "Edit covers status changes and notes.",
    actions: ["view", "edit", "delete"],
  },
  {
    module: "enquiries",
    label: "Contact messages",
    hint: "Messages from the contact form.",
    actions: ["view", "edit", "delete"],
  },
  {
    module: "settings",
    label: "Website settings",
    hint: "Company details, phone numbers and social links.",
    actions: ["view", "edit"],
  },
];

/** Starting point for a new sub-admin: runs website content and the blog, including publishing. */
export const DEFAULT_SUB_ADMIN_PERMISSIONS: PermissionSet = {
  content: { view: true, create: true, edit: true, delete: true },
  blog: { view: true, create: true, edit: true, publish: true, delete: true },
};

export function permissionFieldName(module: AdminModuleName, action: PermissionAction) {
  return `perm.${module}.${action}`;
}

/**
 * Reads the ticked boxes. Only sections and actions listed above are accepted; any write
 * permission switches on View for that section (the database requires it).
 */
export function permissionsFromForm(formData: FormData): PermissionSet {
  const result: PermissionSet = {};
  for (const { module, actions } of MANAGED_MODULES) {
    const flags: Partial<Record<PermissionAction, boolean>> = {};
    for (const action of actions) {
      if (formData.get(permissionFieldName(module, action)) === "on") flags[action] = true;
    }
    if (Object.keys(flags).length) result[module] = { ...flags, view: true };
  }
  return result;
}

/** Plain-language summary, e.g. "Website content, Blog". */
export function permissionSummary(permissions: PermissionSet): string {
  const names = MANAGED_MODULES.filter(({ module }) => permissions[module]?.view).map(({ label }) => label);
  return names.length ? names.join(", ") : "No sections yet";
}
