import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton, StatusText } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { type PermissionSet, permissionSummary } from "@/features/admins/permissions";
import { requireAdmin } from "@/features/auth/admin-session";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin users" };

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <AdminUsers />
    </Suspense>
  );
}

async function AdminUsers() {
  const admin = await requireAdmin();
  if (!admin.isSuperAdmin) return <NoAccess section="admin users" />;

  const supabase = await createClient();
  const [users, perms] = await Promise.all([
    supabase
      .from("admin_users")
      .select("id, email, full_name, role, is_active, last_login_at")
      .order("is_active", { ascending: false })
      .order("full_name"),
    supabase.from("admin_permissions").select("admin_id, module").eq("can_view", true),
  ]);
  if (users.error || perms.error) throw new Error("Unable to load administrators.");

  const access = new Map<string, PermissionSet>();
  for (const row of perms.data) {
    const set = access.get(row.admin_id) ?? {};
    set[row.module] = { view: true };
    access.set(row.admin_id, set);
  }

  return (
    <>
      <AdminPageHeader
        title="Admin users"
        description="People who can sign in to this dashboard, and what each of them can do."
        actions={
          <ButtonLink href="/admin/admins/new" leadingIcon={<Plus className="size-4" aria-hidden="true" />}>
            Invite administrator
          </ButtonLink>
        }
      />
      {users.data.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No administrators"
          description="Invite someone to help manage the website."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Role and access</TH>
              <TH>Last sign-in</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {users.data.map((user) => (
              <TR key={user.id}>
                <TD>
                  <Link
                    href={`/admin/admins/${user.id}`}
                    className="font-medium text-ink underline-offset-4 hover:underline"
                  >
                    {user.full_name}
                  </Link>
                  {user.id === admin.id && <span className="text-stone"> (you)</span>}
                  <p className="text-caption break-all text-stone">{user.email}</p>
                </TD>
                <TD>
                  {user.role === "super_admin" ? (
                    "Super administrator"
                  ) : (
                    <>
                      Administrator
                      <p className="text-caption text-stone">{permissionSummary(access.get(user.id) ?? {})}</p>
                    </>
                  )}
                </TD>
                <TD>
                  {user.last_login_at ? formatDate(user.last_login_at) : <span className="text-stone">Not yet</span>}
                </TD>
                <TD>
                  {!user.is_active ? (
                    <StatusText tone="neutral">Access removed</StatusText>
                  ) : user.last_login_at || user.id === admin.id ? (
                    <StatusText tone="success">Active</StatusText>
                  ) : (
                    <StatusText tone="accent">Invited</StatusText>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
