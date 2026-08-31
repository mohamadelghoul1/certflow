import { escapeHtml } from "@/lib/html";

// The line at the foot of every email a client receives.
//
// Notifications go out from an address nobody watches — notifications@,
// no-reply@ — so a client answering one is writing into a mailbox that
// is never opened. Saying so is the difference between a question that
// reaches the office and a question that is never seen at all, so the
// footer names the way through: the firm's own phone number and address.
//
// Its own module, and tested, because it is the one paragraph that
// appears on every single message the firm sends.

export type FirmContact = { name?: string | null; phone?: string | null; email?: string | null };

export function clientEmailFooter(firm: FirmContact | null): string {
  const phone = (firm?.phone || "").trim();
  const email = (firm?.email || "").trim();

  // Whatever the firm has recorded, in the order someone would try it.
  const routes: string[] = [];
  if (phone) routes.push(`call us on ${escapeHtml(phone)}`);
  if (email) routes.push(`email <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`);

  const how = routes.length ? ` If you need to reach us, please ${routes.join(" or ")}.` : "";

  return `<p style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px">
     This email is sent from an address that is not monitored — please do not reply to it.${how}
   </p>`;
}
