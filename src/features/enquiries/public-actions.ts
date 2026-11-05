"use server";

import { getAuthClaims } from "@/features/auth/admin-session";
import { emailHash, phoneHash } from "@/features/auth/crypto";
import { requestMeta } from "@/features/auth/request-meta";
import { withinRateLimit } from "@/features/auth/security-log";
import { getPublicSiteSettings } from "@/features/listings/queries";
import { publicEnv } from "@/lib/env/client";
import { createServiceClient } from "@/lib/supabase/service";
import { contactSchema, type EnquiryFormState, inspectionSchema, requestReference } from "./schemas";
import { parsePhoneStrict, verifyTurnstile } from "./server";

/**
 * Public submissions. Order of checks: honeypot -> validation -> bot check (Turnstile) ->
 * rate limits -> insert. The insert uses the service role because the tables have no public
 * INSERT policy; the database still enforces every column rule, attaches the property
 * snapshot itself and refuses unlisted properties.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENERIC = "We could not send your request. Please try again in a moment.";

function text(formData: FormData, key: string, max = 6000): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.slice(0, max) : "";
}

function values(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((key) => [key, text(formData, key)]));
}

function errorsOf(issues: Array<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

/** Signed-in customers (Stage 10) get the request linked to their account. Admins never do. */
async function customerIdForRequest(): Promise<string | null> {
  const claims = await getAuthClaims();
  if (!claims) return null;
  const { data } = await createServiceClient()
    .from("customer_profiles")
    .select("id")
    .eq("id", claims.userId)
    .maybeSingle();
  return data?.id ?? null;
}

export interface InspectionResult extends EnquiryFormState {
  whatsappUrl?: string | null;
}

export async function submitInspectionAction(
  propertyId: string,
  _prev: InspectionResult,
  formData: FormData,
): Promise<InspectionResult> {
  if (!UUID.test(propertyId)) return { status: "error", message: GENERIC };
  const kept = values(formData, [
    "full_name",
    "phone",
    "phone_country",
    "email",
    "preferred_date",
    "preferred_time",
    "message",
  ]);

  // Honeypot: a field people never see. Bots that fill it get a normal-looking reply.
  if (text(formData, "website")) return { status: "success", reference: "RECEIVED" };

  const parsed = inspectionSchema().safeParse({ ...kept, consent: text(formData, "consent") });
  const fieldErrors = parsed.success ? {} : errorsOf(parsed.error.issues);
  const phone = parsePhoneStrict(kept.phone, kept.phone_country);
  if (!phone.ok)
    fieldErrors.phone = "Enter a valid phone number, including the country code for numbers outside Nigeria.";
  if (!parsed.success || !phone.ok) return { status: "error", fieldErrors, values: kept };

  if (!(await verifyTurnstile(formData.get("cf-turnstile-response")))) {
    return { status: "error", message: "Please complete the security check and try again.", values: kept };
  }

  const meta = await requestMeta();
  const [ipOk, phoneOk] = await Promise.all([
    withinRateLimit(`inspection:ip:${meta.ipHash}`, [5, 60 * 60]),
    withinRateLimit(`inspection:phone:${phoneHash(phone.e164)}:${propertyId}`, [2, 24 * 60 * 60]),
  ]);
  if (!ipOk)
    return {
      status: "error",
      message: "Too many requests from this connection. Please try again later.",
      values: kept,
    };
  if (!phoneOk) {
    return {
      status: "error",
      message: "We already have an inspection request for this property from this phone number. We will be in touch.",
      values: kept,
    };
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("inspection_requests")
    .insert({
      property_id: propertyId,
      customer_id: await customerIdForRequest(),
      full_name: parsed.data.full_name,
      phone: phone.e164,
      email: parsed.data.email,
      preferred_date: parsed.data.preferred_date,
      preferred_time: parsed.data.preferred_time,
      message: parsed.data.message,
      consent_at: new Date().toISOString(),
    })
    .select("id, property_snapshot")
    .single();
  if (error) {
    const unavailable = error.code === "P0001";
    return {
      status: "error",
      message: unavailable ? "This property is no longer available for inspections." : GENERIC,
      values: kept,
    };
  }

  const reference = requestReference(data.id);
  const snapshot = data.property_snapshot as { title?: string; path?: string };
  const settings = await getPublicSiteSettings();
  const whatsappUrl = settings?.whatsapp_number
    ? `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hello, I have requested an inspection (reference ${reference}) for “${snapshot.title ?? "a property"}”: ${publicEnv().NEXT_PUBLIC_SITE_URL}${snapshot.path ?? ""}`,
      )}`
    : null;

  return { status: "success", reference, whatsappUrl };
}

export async function submitContactAction(_prev: EnquiryFormState, formData: FormData): Promise<EnquiryFormState> {
  const kept = values(formData, ["name", "email", "phone", "phone_country", "subject", "message"]);
  if (text(formData, "website")) return { status: "success", reference: "RECEIVED" };

  const parsed = contactSchema.safeParse({ ...kept, consent: text(formData, "consent") });
  const fieldErrors = parsed.success ? {} : errorsOf(parsed.error.issues);
  let phoneE164: string | null = null;
  if (kept.phone.trim()) {
    const phone = parsePhoneStrict(kept.phone, kept.phone_country);
    if (phone.ok) phoneE164 = phone.e164;
    else fieldErrors.phone = "Enter a valid phone number, or leave it empty.";
  }
  if (!parsed.success || fieldErrors.phone) return { status: "error", fieldErrors, values: kept };

  if (!(await verifyTurnstile(formData.get("cf-turnstile-response")))) {
    return { status: "error", message: "Please complete the security check and try again.", values: kept };
  }

  const meta = await requestMeta();
  const [ipOk, emailOk] = await Promise.all([
    withinRateLimit(`contact:ip:${meta.ipHash}`, [5, 60 * 60]),
    withinRateLimit(`contact:email:${emailHash(parsed.data.email)}`, [3, 60 * 60]),
  ]);
  if (!ipOk || !emailOk) {
    return { status: "error", message: "Too many messages. Please try again later.", values: kept };
  }

  const { data, error } = await createServiceClient()
    .from("contact_submissions")
    .insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: phoneE164,
      subject: parsed.data.subject,
      message: parsed.data.message,
      consent_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { status: "error", message: GENERIC, values: kept };
  return { status: "success", reference: requestReference(data.id) };
}
