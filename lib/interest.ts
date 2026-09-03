import { escapeHtml } from "@/lib/html";

// A certifier asking to join, before they have a login.
//
// The form is public, so it is treated the way a public form has to
// be: every field bounded, an address that has to look like one, and a
// hidden box that only a robot fills in. What survives that is emailed
// to the firm that runs Certlyn, and nothing is stored.

export type InterestFields = { name: string; firm: string; email: string; phone: string; message: string; website: string };

export function readInterest(formData: FormData): InterestFields {
  const text = (name: string, max: number) => String(formData.get(name) || "").trim().slice(0, max);
  return {
    name: text("name", 120),
    firm: text("firm", 160),
    email: text("email", 200),
    phone: text("phone", 40),
    message: text("message", 2000),
    // The honeypot. Not shown to a person; a filled one is a robot.
    website: text("website", 200),
  };
}

export function validateInterest(fields: InterestFields): string | null {
  if (fields.website) return "Thanks — we'll be in touch.";
  if (!fields.name) return "Tell us your name.";
  if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email)) return "That email address doesn't look right.";
  if (!fields.firm) return "Tell us the name of your firm.";
  return null;
}

export function interestEmailHtml(fields: InterestFields): string {
  const row = (label: string, value: string) => (value ? `<tr><td style="padding:4px 12px 4px 0;color:#555"><strong>${label}</strong></td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>` : "");
  return [
    `<p>A certifier has registered their interest in Certlyn.</p>`,
    `<table style="border-collapse:collapse">`,
    row("Name", fields.name),
    row("Firm", fields.firm),
    row("Email", fields.email),
    row("Phone", fields.phone),
    `</table>`,
    fields.message ? `<p style="margin-top:12px"><strong>Message</strong></p><p style="white-space:pre-wrap">${escapeHtml(fields.message)}</p>` : "",
    `<p style="margin-top:16px;color:#777;font-size:12px">Sent from the Register your interest form on certlyn.com.au. Reply to this email to reach them.</p>`,
  ].join("");
}
