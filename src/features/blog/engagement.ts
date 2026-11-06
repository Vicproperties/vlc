"use server";

import { refresh } from "next/cache";
import { getAdminSession, can } from "@/features/auth/admin-session";
import { withinRateLimit } from "@/features/auth/security-log";
import { getCustomer } from "@/features/customers/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Blog likes and comments. Only signed-in customers (verified email, customer profile, not
 * staff) can like or comment; the database checks the same again (RLS). Comments are plain
 * text, shown straight away; the author or an admin with blog "delete" can remove them.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EngagementResult = { ok: true; message?: string } | { ok: false; reason: "sign_in" | "staff" | "error"; message: string };

const SIGN_IN = "Sign in to your customer account to like and comment.";
const STAFF = "Dashboard accounts cannot like or comment. Use a customer account.";

async function customerOrReason(): Promise<{ userId: string } | EngagementResult> {
  const customer = await getCustomer();
  if (!customer) return { ok: false, reason: "sign_in", message: SIGN_IN };
  if (customer.isStaff || !customer.profile) return { ok: false, reason: "staff", message: STAFF };
  return { userId: customer.userId };
}

export async function toggleLikeAction(postId: string): Promise<EngagementResult> {
  if (!UUID.test(postId)) return { ok: false, reason: "error", message: "Something went wrong." };
  const who = await customerOrReason();
  if (!("userId" in who)) return who;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("blog_post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("customer_id", who.userId)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from("blog_post_likes").delete().eq("post_id", postId).eq("customer_id", who.userId)
    : await supabase.from("blog_post_likes").insert({ post_id: postId, customer_id: who.userId });
  if (error) return { ok: false, reason: "error", message: "Something went wrong. Please try again." };
  refresh();
  return { ok: true };
}

export interface CommentFormState {
  status: "idle" | "error" | "success";
  message?: string;
  reason?: "sign_in" | "staff";
}

export async function addCommentAction(
  postId: string,
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  if (!UUID.test(postId)) return { status: "error", message: "Something went wrong." };
  const who = await customerOrReason();
  if (!("userId" in who)) return { status: "error", message: who.ok ? "" : who.message, reason: who.ok ? undefined : (who.reason as "sign_in" | "staff") };
  const raw = formData.get("body");
  const body = typeof raw === "string" ? raw.replace(/\r\n/g, "\n").trim() : "";
  if (body.length < 2) return { status: "error", message: "Write a comment first." };
  if (body.length > 1000) return { status: "error", message: "Keep comments to 1,000 characters." };
  if (!(await withinRateLimit(`comment:${who.userId}`, [5, 10 * 60]))) {
    return { status: "error", message: "You are commenting very quickly. Please wait a few minutes." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("blog_comments").insert({ post_id: postId, customer_id: who.userId, body });
  if (error) return { status: "error", message: "Your comment could not be posted. Please try again." };
  refresh();
  return { status: "success", message: "Comment posted." };
}

/** The comment's author (customer) or an admin with blog "delete" permission. */
export async function deleteCommentAction(commentId: string): Promise<EngagementResult> {
  if (!UUID.test(commentId)) return { ok: false, reason: "error", message: "Something went wrong." };
  const session = await getAdminSession();
  const isModerator = session.status === "verified" && session.admin !== null && can(session.admin, "blog", "delete");
  const customer = isModerator ? null : await getCustomer();
  if (!isModerator && !customer) return { ok: false, reason: "sign_in", message: SIGN_IN };

  const supabase = await createClient();
  // RLS limits deletion to the author or a moderator; .select() tells us whether a row went.
  const { data, error } = await supabase.from("blog_comments").delete().eq("id", commentId).select("id");
  if (error || !data?.length) return { ok: false, reason: "error", message: "This comment could not be deleted." };
  if (isModerator) {
    await supabase.rpc("log_activity", { p_action: "blog.comment_deleted", p_entity_type: "blog_comment", p_entity_id: commentId });
  }
  refresh();
  return { ok: true, message: "Comment deleted." };
}
