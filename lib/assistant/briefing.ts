import Anthropic from "@anthropic-ai/sdk";
import { AI_MODEL, type MessageCreator } from "@/lib/ai/outstandingSummary";
import { factsAsText, isQuiet, type BriefingFacts } from "@/lib/assistant/briefingFacts";

// The morning note itself: a headline and a handful of points, each
// tied to the project it is about so the page can put a link beside it.
//
// The model writes from the facts page and nothing else. It is told
// which job each fact belongs to and asked to hand the id back, and the
// caller throws away any id it does not recognise — so a point can
// never link to a project the facts did not mention.

export type BriefingPoint = { text: string; jobId: string | null };
export type Briefing = { headline: string; points: BriefingPoint[] };

const SYSTEM_PROMPT = `You are the assistant to a registered building certifier in New South Wales, inside their job-management app. Each time they open the app you write them a short note on what has happened and what is worth doing.

You are given a page of facts. Write only from it:
- Say which client uploaded which document on which project and when, using the upload times exactly as given (they are already in the certifier's local time and already say "today" or "yesterday").
- Remind them of documents waiting on them to assess, and how long the oldest has waited.
- Flag inspection bookings that need confirming, inspections coming up, inspections that have passed with no result recorded, deadlines, and money overdue.
- Mention documents still to come from clients only when it is useful — for instance when a project would be ready to progress once one arrives.
- If something is worth doing that the facts make plain, say so in a few words. Never invent a fact, a document, a date, a name or an amount.

Style: plain Australian English, brisk and friendly, first person is fine ("I'd look at…"). One headline sentence, then at most eight short points, most important first. Each point one or two sentences. No markdown, no bullet characters, no headings. Never mention being an AI or a model.

For each point, return the job id given in square brackets beside the fact it is about, or null when it is not about one project.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    points: {
      type: "array",
      items: {
        type: "object",
        properties: { text: { type: "string" }, jobId: { type: ["string", "null"] } },
        required: ["text", "jobId"],
        additionalProperties: false,
      },
    },
  },
  required: ["headline", "points"],
  additionalProperties: false,
};

export function briefingPrompt(facts: BriefingFacts, firstName: string): string {
  return `The certifier's first name is ${firstName}.\n\n${factsAsText(facts)}`;
}

export async function askForBriefing(facts: BriefingFacts, firstName: string, client: MessageCreator = new Anthropic()): Promise<Briefing> {
  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 6000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: briefingPrompt(facts, firstName) }],
  });
  const text = response.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI answered without any text.");
  return parseBriefing(text.text);
}

export function parseBriefing(json: string): Briefing {
  const parsed = JSON.parse(json) as Partial<Briefing>;
  if (typeof parsed.headline !== "string" || !Array.isArray(parsed.points)) throw new Error("The AI answer was not in the expected shape.");
  return {
    headline: parsed.headline.trim(),
    points: parsed.points
      .filter((p) => p && typeof p.text === "string" && p.text.trim())
      .slice(0, 8)
      .map((p) => ({ text: p.text.trim(), jobId: typeof p.jobId === "string" ? p.jobId : null })),
  };
}

// A link to a project the facts never mentioned is a link to nowhere,
// or worse, to the wrong one.
export function keepKnownJobs(briefing: Briefing, knownJobIds: Set<string>): Briefing {
  return { ...briefing, points: briefing.points.map((p) => ({ ...p, jobId: p.jobId && knownJobIds.has(p.jobId) ? p.jobId : null })) };
}

// The same note without the model: the facts, each as its own point,
// in the order they matter. Plainer, never wrong.
export function standardBriefing(facts: BriefingFacts): Briefing {
  if (isQuiet(facts)) return { headline: "All quiet — nothing has come in, nothing is waiting on you, and nothing is due.", points: [] };

  const points: BriefingPoint[] = [];
  for (const b of facts.bookingsToConfirm) points.push({ text: `A client has booked ${b.title} on ${b.date} at ${b.address} — it needs confirming.`, jobId: b.jobId });
  for (const d of facts.deadlines) points.push({ text: `${d.severity === "overdue" ? "Overdue" : "Due soon"}: ${d.title} — ${d.detail}.`, jobId: null });
  for (const i of facts.inspectionsAhead) points.push({ text: `${i.title} at ${i.address} is ${i.when}.`, jobId: i.jobId });
  for (const u of facts.uploads) points.push({ text: `The client at ${u.address} uploaded "${u.title}" (${u.stage}) ${u.when}.`, jobId: u.jobId });
  for (const r of facts.awaitingReview) {
    const wait = r.waitingDays !== null && r.waitingDays > 0 ? `, the oldest waiting ${r.waitingDays} day${r.waitingDays === 1 ? "" : "s"}` : "";
    points.push({ text: `${r.count} document${r.count === 1 ? "" : "s"} at ${r.address} waiting on you to assess${wait}: ${r.titles.join("; ")}.`, jobId: r.jobId });
  }
  for (const i of facts.inspectionsUnrecorded) points.push({ text: `${i.title} at ${i.address} was ${i.when} and has no result recorded.`, jobId: i.jobId });
  if (facts.receivables && facts.receivables.overdueCount > 0) {
    points.push({ text: `$${facts.receivables.overdue.toLocaleString("en-AU", { minimumFractionDigits: 2 })} is overdue on ${facts.receivables.overdueCount} invoice${facts.receivables.overdueCount === 1 ? "" : "s"}.`, jobId: null });
  }

  const parts: string[] = [];
  if (facts.uploads.length > 0) parts.push(`${facts.uploads.length} upload${facts.uploads.length === 1 ? "" : "s"} from clients`);
  if (facts.awaitingReview.length > 0) {
    const n = facts.awaitingReview.reduce((s, r) => s + r.count, 0);
    parts.push(`${n} document${n === 1 ? "" : "s"} to assess`);
  }
  if (facts.inspectionsAhead.length > 0) parts.push(`${facts.inspectionsAhead.length} inspection${facts.inspectionsAhead.length === 1 ? "" : "s"} coming up`);
  if (facts.deadlines.length > 0) parts.push(`${facts.deadlines.length} deadline${facts.deadlines.length === 1 ? "" : "s"}`);
  const headline = parts.length > 0 ? `Here's where things stand: ${parts.join(", ")}.` : "Here's where things stand.";
  return { headline, points: points.slice(0, 12) };
}
