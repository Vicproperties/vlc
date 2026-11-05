import "server-only";
import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env/server";
import type { EmailContent } from "./templates";

/**
 * Sends transactional email through the Resend HTTP API.
 *
 * Temporary failures (network errors, timeouts, rate limiting, Resend server errors) are
 * retried up to 3 attempts in total. Every attempt carries the same Idempotency-Key, so
 * Resend never delivers the email twice even if an earlier attempt actually got through.
 *
 * EMAIL_TRANSPORT=disabled skips delivery (automated end-to-end tests, which cannot read a
 * real inbox). It is refused on Vercel production deployments so it can never silently
 * disable login codes for real users.
 */
export type SendResult = { ok: true } | { ok: false; reason: string };

const ATTEMPTS = 3;
const BACKOFF_MS = [600, 1800];

function retryable(reason: string): boolean {
  return (
    reason === "network" || reason === "timeout" || reason === "resend_http_429" || /^resend_http_5\d\d$/.test(reason)
  );
}

export async function sendEmail(to: string, content: EmailContent): Promise<SendResult> {
  if (process.env.EMAIL_TRANSPORT === "disabled") {
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("EMAIL_TRANSPORT=disabled is not allowed in production.");
    }
    return { ok: true };
  }

  const idempotencyKey = randomUUID();
  let result: SendResult = { ok: false, reason: "network" };
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt - 1]));
    result = await sendOnce(to, content, idempotencyKey);
    if (result.ok || !retryable(result.reason)) return result;
  }
  return result;
}

async function sendOnce(to: string, content: EmailContent, idempotencyKey: string): Promise<SendResult> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serverEnv("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
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
