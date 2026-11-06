import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminAccessControls, AdminUserForm } from "@/components/admin/admin-user-form";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Notice } from "@/components/ui/notice";
import { Skeleton, StatusText } from "@/components/ui/states";
import type { PermissionSet } from "@/features/admins/permissions";
import { requireAdmin } from "@/features/auth/admin-session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Administrator" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AdminUserPage({ params, searchParams }: PageProps<"/admin/admins/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <AdminUser params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function AdminUser({
  params,
  searchParams,
}: {
  params: PageProps<"/admin/admins/[id]">["params"];
  searchParams: PageProps<"/admin/admins/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) return <NoAccess section="admin users" />;

  const supabase = await createClient();
  const [user, perms] = await Promise.all([
    supabase
      .from("admin_users")
      .select("id, email, full_name, role, is_active, last_login_at, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("admin_permissions")
      .select("module, can_view, can_create, can_edit, can_publish, can_delete")
      .eq("admin_id", id),
  ]);
  if (user.error || perms.error) throw new Error("Unable to load the administrator.");
  if (!user.data) notFound();
  const target = user.data;
  const isSelf = target.id === admin.id;

  const permissions: PermissionSet = {};
  for (const row of perms.data) {
    permissions[row.module] = {
      view: row.can_view,
      create: row.can_create,
      edit: row.can_edit,
      publish: row.can_publish,
      delete: row.can_delete,
    };
  }

  return (
    <>
      <Link href="/admin/admins" className="text-small text-stone underline-offset-4 hover:underline">
        Back to admin users
      </Link>
      <AdminPageHeader
        title={target.full_name}
        description={
          <>
            {target.email} · Added {formatDate(target.created_at)} · Last sign-in{" "}
            {target.last_login_at ? formatDate(target.last_login_at) : "not yet"}
          </>
        }
        actions={
          target.is_active ? (
            <StatusText tone="success">Active</StatusText>
          ) : (
            <StatusText tone="neutral">Access removed</StatusText>
          )
        }
      />
      {query.invited === "1" && (
        <Notice tone="success">
          Invitation sent to {target.email}. The link lets them set a password; they then sign in at the dashboard
          sign-in page.
        </Notice>
      )}
      {query.invited === "failed" && (
        <Notice tone="error">
          The administrator was added, but the invitation email could not be sent. Use “Send password setup link” below
          to try again.
        </Notice>
      )}
      {isSelf ? (
        <Notice tone="info">
          This is your account. Another super administrator must change your role or access. To change your password,
          sign out and use “Forgot password” on the sign-in page.
        </Notice>
      ) : (
        <>
          {!target.is_active && (
            <Notice tone="info">This person cannot sign in. Restore access to let them back in.</Notice>
          )}
          <AdminUserForm
            mode="edit"
            initial={{
              id: target.id,
              fullName: target.full_name,
              email: target.email,
              role: target.role,
              permissions,
            }}
          />
          <section className="flex flex-col gap-4 border-t border-line pt-8">
            <h2 className="text-body font-semibold text-ink">Access</h2>
            <p className="text-small text-stone">
              If they have not set a password yet or have forgotten it, send a new password setup link.
            </p>
            <AdminAccessControls id={target.id} name={target.full_name} isActive={target.is_active} />
          </section>
        </>
      )}
    </>
  );
}
