import { escapeHtml } from "@/lib/html";
import { formatISODate } from "@/lib/business";

// The email that carries an inspection report to the client.
//
// Written to be read on a phone by someone who wants one fact: did it
// pass. That goes in the subject line, because a client scrolling their
// inbox on site should not have to open anything to find out.

const OUTCOME_WORDS: Record<string, { subject: string; line: string }> = {
  passed: { subject: "passed", line: "The inspection passed. No issues were recorded." },
  passed_subject_to: {
    subject: "satisfactory, with items to address",
    line: "The inspection was satisfactory, subject to the items listed in the report being addressed.",
  },
  failed: { subject: "did not pass", line: "The inspection did not pass. The report sets out what was found and what is required." },
};

export function inspectionReportEmail(opts: { title: string; outcome: string; date: string | null; address: string | null }): { subject: string; html: string } {
  const words = OUTCOME_WORDS[opts.outcome] || { subject: "completed", line: "The inspection has been completed and the report is attached." };
  const site = (opts.address || "").trim();

  const html = [
    `<p>The <strong>${escapeHtml(opts.title)}</strong> inspection${site ? ` at <strong>${escapeHtml(site)}</strong>` : ""}${
      opts.date ? ` was carried out on ${escapeHtml(formatISODate(opts.date))}` : " has been carried out"
    }.</p>`,
    `<p>${escapeHtml(words.line)}</p>`,
    `<p>The full report is attached, and is also in your portal.</p>`,
    `<p>Please read it in full — anything recorded there needs to be addressed before the next inspection can be booked.</p>`,
  ].join("");

  return {
    subject: `${opts.title} inspection ${words.subject}${site ? ` — ${site}` : ""}`,
    html,
  };
}
