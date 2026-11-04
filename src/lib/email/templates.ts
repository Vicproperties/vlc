import { siteConfig } from "@/config/site";

/**
 * Transactional email templates. Plain, table-free HTML with inline styles (email clients
 * ignore stylesheets) plus a text version. All dynamic values are escaped.
 */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const colors = { ink: "#2a1f45", stone: "#625b73", brand: "#6b4ba6", line: "#e7e1f1", surface: "#faf8fd" };

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#ffffff;color:${colors.ink};font-family:Helvetica,Arial,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:40px 24px;">
<p style="margin:0 0 32px;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:${colors.ink};">${escapeHtml(siteConfig.name)}</p>
${body}
<p style="margin:40px 0 0;padding-top:20px;border-top:1px solid ${colors.line};font-size:12px;line-height:1.6;color:${colors.stone};">
This is an automated security message from the ${escapeHtml(siteConfig.name)} administration system. Do not forward it.
</p>
</div>
</body>
</html>`;
}

const p = (text: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${text}</p>`;

export function otpEmail({ name, code, minutes }: { name: string; code: string; minutes: number }): EmailContent {
  // The code is never put in the subject: it would show on lock-screen notifications.
  const subject = "Your dashboard sign-in code";
  const html = layout(
    subject,
    [
      p(`Hello ${escapeHtml(name)},`),
      p("Use this code to finish signing in to the dashboard:"),
      `<p style="margin:0 0 16px;padding:16px 20px;background:${colors.surface};border:1px solid ${colors.line};font-size:28px;letter-spacing:8px;font-weight:600;font-family:'Courier New',monospace;">${escapeHtml(code)}</p>`,
      p(`The code expires in ${minutes} minutes and can only be used once.`),
      p(
        "If you did not try to sign in, someone may know your password. Change it from the sign-in page and tell a super administrator.",
      ),
    ].join("\n"),
  );
  const text = [
    `Hello ${name},`,
    "",
    `Your sign-in code is: ${code}`,
    "",
    `It expires in ${minutes} minutes and can only be used once.`,
    "If you did not try to sign in, someone may know your password. Change it from the sign-in page and tell a super administrator.",
  ].join("\n");
  return { subject, html, text };
}

export function passwordLinkEmail({
  name,
  link,
  kind,
}: {
  name: string;
  link: string;
  kind: "reset" | "invite";
}): EmailContent {
  const subject =
    kind === "invite" ? `Set up your ${siteConfig.name} dashboard account` : "Reset your dashboard password";
  const intro =
    kind === "invite"
      ? "An administrator account has been created for you. Choose a password to activate it:"
      : "We received a request to reset your dashboard password. Choose a new password here:";
  const button = kind === "invite" ? "Set your password" : "Reset password";
  const safeLink = escapeHtml(link);
  const html = layout(
    subject,
    [
      p(`Hello ${escapeHtml(name)},`),
      p(intro),
      `<p style="margin:0 0 24px;"><a href="${safeLink}" style="display:inline-block;padding:12px 24px;background:${colors.brand};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;border-radius:2px;">${button}</a></p>`,
      p(
        `Or copy this address into your browser:<br><span style="word-break:break-all;color:${colors.stone};font-size:13px;">${safeLink}</span>`,
      ),
      p("The link expires in 1 hour and can only be used once."),
      kind === "reset" ? p("If you did not ask for this, ignore this email. Your password will not change.") : "",
    ].join("\n"),
  );
  const text = [
    `Hello ${name},`,
    "",
    intro,
    link,
    "",
    "The link expires in 1 hour and can only be used once.",
    kind === "reset" ? "If you did not ask for this, ignore this email. Your password will not change." : "",
  ].join("\n");
  return { subject, html, text };
}
