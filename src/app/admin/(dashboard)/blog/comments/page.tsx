import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MessageSquare } from "lucide-react";
import { DeleteComment } from "@/components/admin/delete-comment";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Blog comments" };

const when = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });

export default function BlogCommentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <BlogComments />
    </Suspense>
  );
}

async function BlogComments() {
  const admin = await requireAdmin();
  if (!can(admin, "blog", "view")) return <NoAccess section="the blog" />;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_comments")
    .select("id, body, created_at, customer_id, post:blog_posts(title, slug)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("Unable to load comments.");

  // Commenter names, read server-side (customer profiles are not open to every admin).
  const ids = [...new Set(data.map((c) => c.customer_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await createServiceClient()
      .from("customer_profiles")
      .select("id, full_name")
      .in("id", ids);
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? "Customer");
  }
  const canDelete = can(admin, "blog", "delete");

  return (
    <>
      <Link href="/admin/blog" className="text-small text-stone underline-offset-4 hover:underline">
        Back to the blog
      </Link>
      <AdminPageHeader
        title="Blog comments"
        description="Newest first. Comments appear on the website straight away; delete any that are spam or inappropriate."
      />
      {data.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments yet" description="Comments from customers appear here." />
      ) : (
        <ul className="flex flex-col gap-4">
          {data.map((c) => {
            const post = c.post as unknown as { title: string; slug: string } | null;
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-small text-stone">
                    <span className="font-semibold text-ink">{names.get(c.customer_id) ?? "Customer"}</span> on{" "}
                    {post ? (
                      <a
                        href={`/blog/${post.slug}#comments`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand underline-offset-4 hover:underline"
                      >
                        {post.title}
                      </a>
                    ) : (
                      "a deleted article"
                    )}{" "}
                    · {when.format(new Date(c.created_at))}
                  </p>
                  {canDelete && <DeleteComment id={c.id} />}
                </div>
                <p className="text-small whitespace-pre-line text-ink">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
