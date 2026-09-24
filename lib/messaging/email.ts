import { Resend } from "resend";

/**
 * Transactional e-mail through Resend (SPECS A8).
 *
 * Without RESEND_API_KEY the message is logged instead of sent, so every flow
 * stays runnable in development and in preview deployments. The caller learns
 * which happened.
 */
export type EmailResult = { sent: true; id: string | null } | { sent: false; reason: string };

export type EmailAttachment = { filename: string; content: Buffer };

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "CISSP Bootcamp <bonjour@cisspbootcamp.online>";

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY absent — non envoyé à ${input.to} : ${input.subject}`);
    return { sent: false, reason: "RESEND_API_KEY manquante" };
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? textToHtml(input.text),
    attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
  });

  if (error) {
    console.error("[email] échec Resend", error);
    return { sent: false, reason: error.message };
  }

  return { sent: true, id: data?.id ?? null };
}

/** Minimal, readable HTML for plain-text drafts: paragraphs and line breaks. */
export function textToHtml(text: string): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.55;color:#0f172a;max-width:600px">${paragraphs}</div>`;
}
