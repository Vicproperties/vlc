import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import type { AdminModule } from "@/config/admin-nav";
import { logoutAction } from "@/features/auth/actions";
import { type AdminContext, can, requireAdmin } from "@/features/auth/admin-session";

/**
 * Dashboard shell. The session check streams in behind Suspense (Cache Components), so the
 * prerendered shell contains only a skeleton — no admin data. Every page and Server Action
 * still performs its own requireAdmin() / requireAdminPermission() check.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}

/** Sidebar entries this admin may see (hiding is UX only; access is enforced server-side). */
function visibleModules(admin: AdminContext): AdminModule[] {
  const view = (module: Parameters<typeof can>[1]) => can(admin, module, "view");
  const modules: AdminModule[] = ["overview"];
  if (view("properties")) modules.push("properties");
  if (view("estates")) modules.push("estates");
  if (view("inspections") || view("enquiries")) modules.push("inspections");
  if (view("blog")) modules.push("blog");
  if (view("content")) modules.push("content");
  if (view("marketing") || view("newsletter")) modules.push("marketing");
  if (view("media")) modules.push("media");
  if (view("settings")) modules.push("settings");
  // Only super admins manage administrators (sub-admins are never given "admins").
  if (admin.isSuperAdmin) modules.push("admins");
  if (view("analytics")) modules.push("analytics");
  if (view("cookies")) modules.push("cookies");
  if (view("activity_logs")) modules.push("activity_logs");
  return modules;
}

async function DashboardShell({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const modules = visibleModules(admin);

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar allowedModules={modules} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-surface px-4 sm:px-8">
          <AdminMobileNav allowedModules={modules} />
          <div className="ml-auto flex min-w-0 items-center gap-4">
            <div className="flex min-w-0 flex-col items-end leading-tight">
              <span className="truncate text-small font-medium text-ink">{admin.fullName}</span>
              <span className="text-caption text-stone">
                {admin.isSuperAdmin ? "Super administrator" : "Administrator"}
              </span>
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="quiet"
                size="sm"
                leadingIcon={<LogOut className="size-4" strokeWidth={1.5} aria-hidden="true" />}
              >
                Sign out
              </Button>
            </form>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">{children}</div>
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" aria-busy="true">
      <div className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block" />
      <div className="flex flex-1 flex-col">
        <div className="h-16 border-b border-line bg-surface" />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 lg:px-10">
          <p className="sr-only">Loading dashboard</p>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}
