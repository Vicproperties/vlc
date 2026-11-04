import { notFound } from "next/navigation";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar";

/**
 * Dashboard shell.
 *
 * SECURITY: until authentication is implemented (Stage 4) this shell is available in
 * development only and returns 404 in production. Stage 4 replaces this guard with
 * server-side `requireAdmin()` checks and passes `allowedModules` from the permission matrix.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-line bg-surface px-4 sm:px-8">
          <AdminMobileNav />
          <p className="text-small text-stone">Development preview — authentication arrives in Stage 4</p>
        </header>
        <main id="main" className="flex-1 px-4 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
