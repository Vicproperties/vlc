import { z } from "zod";

/**
 * Public enquiry forms (inspection requests, contact messages). Validation here gives clear
 * messages; the database CHECK constraints are the final guard. Phone numbers are checked
 * authoritatively on the server (full metadata) in `phone-server.ts`.
 */
export const PREFERRED_TIMES = ["morning", "afternoon", "evening"] as const;
export const PREFERRED_TIME_LABELS: Record<(typeof PREFERRED_TIMES)[number], string> = {
  morning: "Morning (9am to 12pm)",
  afternoon: "Afternoon (12pm to 4pm)",
  evening: "Evening (4pm to 6pm)",
};

const name = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(120, "Use 120 characters or fewer.")
  .refine((value) => !/[<>]/.test(value), "Use letters, spaces and common punctuation only.");

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .transform((value, ctx) => {
    if (!value) return null;
    if (!z.email().safeParse(value).success) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email address." });
      return z.NEVER;
    }
    return value;
  });

const consent = z.literal("on", { error: "Please agree so that we can contact you about your request." });

/** Dates are compared as Lagos calendar days (YYYY-MM-DD). */
export function lagosToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(now);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const MAX_DAYS_AHEAD = 180;

export function inspectionSchema(today = lagosToday()) {
  return z.object({
    full_name: name,
    email: optionalEmail,
    preferred_date: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!value) return null;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
          ctx.addIssue({ code: "custom", message: "Choose a valid date." });
          return z.NEVER;
        }
        if (value < today) {
          ctx.addIssue({ code: "custom", message: "Choose today or a later date." });
          return z.NEVER;
        }
        if (value > addDays(today, MAX_DAYS_AHEAD)) {
          ctx.addIssue({ code: "custom", message: "Choose a date within the next 6 months." });
          return z.NEVER;
        }
        return value;
      }),
    preferred_time: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (!value) return null;
        if (!(PREFERRED_TIMES as readonly string[]).includes(value)) {
          ctx.addIssue({ code: "custom", message: "Choose a time of day from the list." });
          return z.NEVER;
        }
        return value;
      }),
    message: z
      .string()
      .trim()
      .max(3000, "Use 3,000 characters or fewer.")
      .transform((value) => value || null),
    consent,
  });
}

export const contactSchema = z.object({
  name,
  email: z
    .string({ error: "Enter your email address." })
    .trim()
    .toLowerCase()
    .max(254, "Enter a valid email address.")
    .pipe(z.email({ error: "Enter a valid email address." })),
  subject: z
    .string()
    .trim()
    .max(200, "Use 200 characters or fewer.")
    .transform((value) => value || null),
  message: z.string().trim().min(2, "Enter your message.").max(5000, "Use 5,000 characters or fewer."),
  consent,
});

export interface EnquiryFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
  /** Set on success. */
  reference?: string;
}

export const initialEnquiryState: EnquiryFormState = { status: "idle" };

/** Short, human-friendly reference shown to the visitor and staff (first 8 hex characters). */
export function requestReference(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
