import Anthropic from "@anthropic-ai/sdk";
import { pathwayLabel, type Pathway } from "@/lib/business";
import { escapeHtml } from "@/lib/html";
import type { OutstandingStage } from "@/lib/outstandingDocuments";

// A plain-language note to the client about what is still needed.
//
// The list itself is the app's — outstandingStages decides what is on
// it. What the model adds is the sentence beside each document: what a
// "Section 10.7 certificate" or a "BASIX certificate" actually is, who
// prepares it, what it has to show — the explanation a certifier gives
// on the phone a dozen times a week. The model is told, twice, that it
// may not add a document, drop one, or rule on whether one is required;
// and the text is assembled here from the app's list, so a description
// for a title that was never asked about has nowhere to land.
//
// What leaves the building: the pathway, the description of the works,
// and the titles and library descriptions of the outstanding documents.
// No names, no addresses, no files.
//
// Without an API key the same summary is written from the library's own
// descriptions — shorter, but never wrong — so the feature degrades to
// "standard" rather than to nothing.

export const AI_MODEL = "claude-opus-5";

export function aiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export type SummaryInput = { pathway: Pathway; worksDescription: string | null; stages: OutstandingStage[] };

export type WrittenDescriptions = { intro: string; items: { title: string; whatIsNeeded: string }[]; closing: string };

const SYSTEM_PROMPT = `You write on behalf of a registered building certifier in New South Wales, Australia, to the applicant on a building project — usually a homeowner or a builder.

You are given the documents the certifier is still waiting on, grouped by stage of the project (the application for a Complying Development Certificate or Construction Certificate, the Notice of Commencement, the Occupation Certificate, or a modification).

For each document, write one or two plain-English sentences saying what it is, who normally prepares or issues it, and what it needs to show, so the applicant can obtain the right thing first time. Where a document is marked as needing changes, say that it was received but has to be corrected as noted in their portal.

Rules that must not be broken:
- Describe only the documents you are given. Never add a document, leave one out, or combine two.
- Do not say whether a document is legally required or cite clause numbers, sections or legislation, unless they already appear in the title or description you were given. The certifier has already decided the list.
- Australian English. Warm but businesslike. No headings, no markdown, no bullet characters — the sentences are placed into a list by the application.
- Never mention that any of this was written by an AI or a model.

Also write an intro of one or two sentences and a single closing sentence, suitable for an email from the certifier to the applicant. Return the title of each document exactly as it was given to you.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, whatIsNeeded: { type: "string" } },
        required: ["title", "whatIsNeeded"],
        additionalProperties: false,
      },
    },
    closing: { type: "string" },
  },
  required: ["intro", "items", "closing"],
  additionalProperties: false,
};

function stateWords(state: OutstandingStage["items"][number]["state"]): string {
  return state === "needs_changes" ? "received, needs changes" : "not yet received";
}

export function summaryPrompt(input: SummaryInput): string {
  const lines: string[] = [];
  lines.push(`Project type: ${input.pathway === "PC_OC" ? "Principal Certifier appointment and Occupation Certificate only (the CDC or CC was issued by another certifier)" : `${pathwayLabel(input.pathway)} application, Principal Certifier appointment and Occupation Certificate`}`);
  lines.push(`Description of the works: ${input.worksDescription?.trim() || "(not recorded)"}`);
  lines.push("");
  lines.push("Documents still outstanding:");
  for (const stage of input.stages) {
    lines.push("");
    lines.push(`Stage: ${stage.label}`);
    for (const item of stage.items) {
      const description = item.description ? ` — ${item.description}` : "";
      lines.push(`- ${item.title} [${stateWords(item.state)}]${description}`);
    }
  }
  return lines.join("\n");
}

// The narrowest slice of the SDK the call needs, so a test can hand in
// a stand-in without building a whole client.
export type MessageCreator = { messages: { create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> } };

export async function askForDescriptions(input: SummaryInput, client: MessageCreator = new Anthropic()): Promise<WrittenDescriptions> {
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: summaryPrompt(input) }],
  });

  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI answered without any text.");
  return parseWritten(text.text);
}

// The structured output is a contract, but the text still crosses a
// network: a truncated answer is caught here, not in the summary.
export function parseWritten(json: string): WrittenDescriptions {
  const parsed = JSON.parse(json) as Partial<WrittenDescriptions>;
  if (typeof parsed.intro !== "string" || typeof parsed.closing !== "string" || !Array.isArray(parsed.items)) {
    throw new Error("The AI answer was not in the expected shape.");
  }
  return {
    intro: parsed.intro,
    closing: parsed.closing,
    items: parsed.items.filter((i) => i && typeof i.title === "string" && typeof i.whatIsNeeded === "string"),
  };
}

// Words the certifier can say themselves, in plain language, so the
// message is the same one the model would have been asked to make
// specific — which is how a user recognises what the AI did and did not
// change.
export function describeAiError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The AI key in Vercel was not accepted — check ANTHROPIC_API_KEY under Settings → Environment Variables.";
  if (error instanceof Anthropic.RateLimitError) return "The AI service is busy right now — try again in a minute.";
  if (error instanceof Anthropic.APIConnectionError) return "The AI service could not be reached — try again shortly.";
  if (error instanceof Anthropic.APIError) return `The AI service answered with an error (${error.status ?? "unknown"}): ${error.message}`;
  return error instanceof Error ? error.message : "The summary could not be written.";
}

const DEFAULT_INTRO = "The following documents are still needed so your project can keep moving:";
const DEFAULT_CLOSING = "You can upload them straight into your portal, and we'll take it from there.";

function normalise(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// The summary as sent: the app's list, with the model's sentence beside
// each item where it wrote one, the library's where it did not. A title
// the model returned that is not on the list is ignored.
export function assembleSummary(stages: OutstandingStage[], written: WrittenDescriptions | null): string {
  const byTitle = new Map((written?.items || []).map((i) => [normalise(i.title), i.whatIsNeeded.trim()]));
  const lines: string[] = [written?.intro.trim() || DEFAULT_INTRO];

  for (const stage of stages) {
    lines.push("");
    lines.push(stage.label);
    for (const item of stage.items) {
      const needsChanges = item.state === "needs_changes";
      const explanation =
        byTitle.get(normalise(item.title)) ||
        item.description?.trim() ||
        (needsChanges ? "Received, but it needs changes — see the note in your portal." : "Not yet received.");
      lines.push(`• ${item.title}${needsChanges ? " (needs changes)" : ""} — ${explanation}`);
    }
  }

  lines.push("");
  lines.push(written?.closing.trim() || DEFAULT_CLOSING);
  return lines.join("\n");
}

// The text as it goes into the email: bullets become a list, a line that
// introduces one becomes its heading, everything else a paragraph.
export function summaryToHtml(text: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const parts: string[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (bullets.length === 0) return;
    parts.push(`<ul style="margin-top:0">${bullets.map((b) => `<li style="margin-bottom:2px">${escapeHtml(b)}</li>`).join("")}</ul>`);
    bullets = [];
  };

  lines.forEach((line, i) => {
    if (!line) return;
    if (/^[•\-*]\s+/.test(line)) {
      bullets.push(line.replace(/^[•\-*]\s+/, ""));
      return;
    }
    flush();
    const next = lines.slice(i + 1).find((l) => l);
    const heading = !!next && /^[•\-*]\s+/.test(next);
    parts.push(heading ? `<p style="margin-bottom:4px"><strong>${escapeHtml(line)}</strong></p>` : `<p>${escapeHtml(line)}</p>`);
  });
  flush();
  return parts.join("");
}
