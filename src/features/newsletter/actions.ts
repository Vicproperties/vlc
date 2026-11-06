"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdminPermission } from "@/features/auth/admin-session";
import { emailHash } from "@/features/auth/crypto";
import { requestMeta } from "@/features/auth/request-meta";
import { withinRateLimit } from "@/features/auth/security-log";
import { sendEmail } from "@/lib/email/send";
import { newsletterConfirmEmail } from "@/lib/email/templates";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hashToken, newConfirmToken, newsletterLinks, validUnsubscribeSignature } from "./server";

/**
 * Newsletter with double opt-in. The public form never reveals whether an address is already
 * subscribed: every valid request gets the same answer. Only a click on the emailed link
 * makes a subscription active. Visitors have no table access; the server writes with the
 * service role after its own checks.
 */
export interface NewsletterState {
  status: "idle" | "error" | "success";
  message?: string;
}

export interface NewsletterResult {
  ok: boolean;
  message: string;
}

const CONSENT_VERSION = "2026-11-06";
const CONFIRM_HOURS = 48;
const TOKEN = /^[A-Za-z0-9_-]{40,60}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECK_INBOX = "Thank you. Check your inbox and click the link to confirm your subscription.";

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

export async function subscribeAction(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  // Honeypot: bots fill every field. Pretend it worked.
  if (formData.get("website")) return { status: "success", message: CHECK_INBOX };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  const email = parsed.data;

  const meta = await requestMeta();
  const [ipOk, emailOk] = await Promise.all([
    withinRateLimit(`newsletter:ip:${meta.ipHash}`, [10, 60 * 60]),
    withinRateLimit(`newsletter:email:${emailHash(email)}`, [3, 24 * 60 * 60]),
  ]);
  if (!ipOk) return { status: "error", message: "Too many attempts. Please try again later." };
  // Per-address limit: answer as if sent, so the form cannot be used to flood one inbox.
  if (!emailOk) return { status: "success", message: CHECK_INBOX };

  const service = createServiceClient();
  const { data: existing } = await service
    .from("newsletter_subscribers")
    .select("id, status")
    .eq("email", email)
    .maybeSingle();
  if (existing?.status === "active") return { status: "success", message: CHECK_INBOX };

  const { token, hash } = newConfirmToken();
  const pending = {
    status: "pending" as const,
    source: String(formData.get("source") ?? "website").slice(0, 60),
    consent_text_version: CONSENT_VERSION,
    confirm_token_hash: hash,
    confirm_token_expires_at: new Date(Date.now() + CONFIRM_HOURS * 3600_000).toISOString(),
    unsubscribed_at: null,
  };
  const saved = existing
    ? await service.from("newsletter_subscribers").update(pending).eq("id", existing.id).select("id").single()
    : await service
        .from("newsletter_subscribers")
        .insert({ email, ...pending })
        .select("id")
        .single();
  if (saved.error) return { status: "error", message: "Something went wrong. Please try again." };

  const links = newsletterLinks(saved.data.id, token);
  const sent = await sendEmail(
    email,
    newsletterConfirmEmail({ link: links.confirm, unsubscribeLink: links.unsubscribe }),
  );
  if (!sent.ok)
    return { status: "error", message: "The confirmation email could not be sent. Please try again later." };
  return { status: "success", message: CHECK_INBOX };
}

/** Called by the confirmation page's button (a click, so link scanners cannot confirm). */
export async function confirmSubscriptionAction(token: string): Promise<NewsletterResult> {
  if (!TOKEN.test(token)) return { ok: false, message: "This confirmation link is not valid." };
  const service = createServiceClient();
  const { data, error } = await service
    .from("newsletter_subscribers")
    .update({
      status: "active",
      confirmed_at: new Date().toISOString(),
      confirm_token_hash: null,
      confirm_token_expires_at: null,
    })
    .eq("confirm_token_hash", hashToken(token))
    .eq("status", "pending")
    .gt("confirm_token_expires_at", new Date().toISOString())
    .select("id");
  if (error || !data?.length) {
    return {
      ok: false,
      message: "This confirmation link has expired or was already used. Subscribe again to get a new one.",
    };
  }
  return { ok: true, message: "Your subscription is confirmed. Thank you." };
}

export async function unsubscribeAction(id: string, signature: string): Promise<NewsletterResult> {
  if (!UUID.test(id) || typeof signature !== "string" || !validUnsubscribeSignature(id, signature)) {
    return { ok: false, message: "This unsubscribe link is not valid." };
  }
  const { error } = await createServiceClient()
    .from("newsletter_subscribers")
    .update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
      confirm_token_hash: null,
      confirm_token_expires_at: null,
    })
    .eq("id", id);
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  return { ok: true, message: "You have been unsubscribed and will not receive further emails." };
}

/** Dashboard: permanently remove a subscriber (for example on a data deletion request). */
export async function deleteSubscriberAction(id: string): Promise<NewsletterResult> {
  if (!UUID.test(id)) throw new Error("Invalid id.");
  await requireAdminPermission("newsletter", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", id);
  if (error) return { ok: false, message: dbErrorMessage(error) };
  await supabase.rpc("log_activity", {
    p_action: "newsletter.subscriber_deleted",
    p_entity_type: "newsletter_subscriber",
    p_entity_id: id,
  });
  refresh();
  return { ok: true, message: "Subscriber deleted." };
}
