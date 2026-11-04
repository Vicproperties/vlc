import "server-only";
import { serverEnv } from "@/lib/env/server";
import type { EmailContent } from "./templates";

/**
 * Sends transactional email through the Resend HTTP API.
 *
 * EMAIL_TRANSPORT=disabled skips delivery (automated end-to-end tests, which cannot read a
 * real inbox). It is refused on Vercel production deployments so it can never silently
 * disable login codes for real users.
 */
export type SendResult = { ok: true } | { ok: false; reason: string };

export async function sendEmail(to: string, content: EmailContent): Promise<SendResult> {
  if (process.env.EMAIL_TRANSPORT === "disabled") {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("EMAIL_TRANSPORT=disabled is not allowed in production.");
    }
    return { ok: true };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: serverEnv("EMAIL_FROM"),
        to: [to],
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      // Status only: the response body may echo the recipient.
      return { ok: false, reason: `resend_http_${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" };
  }
}
