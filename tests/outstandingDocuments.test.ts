import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { outstandingStages, outstandingTotal, clientFacing, stageLabel } from "@/lib/outstandingDocuments";
import { assembleSummary, summaryPrompt, summaryToHtml, parseWritten, askForDescriptions, type MessageCreator } from "@/lib/ai/outstandingSummary";

// The list is the app's; the AI only writes the sentence beside each
// item. These tests hold both halves to that: the list is read off the
// checklists and nothing else, and the assembled note carries exactly
// the app's items whatever the model returned.

const item = (title: string, status: string, extra: Record<string, unknown> = {}) => ({ title, status, ...extra });

describe("reading what is outstanding off the checklists", () => {
  test("requested, submitted and sent-back items are outstanding; approved ones are not", () => {
    const stages = outstandingStages(
      [
        {
          kind: "pathway",
          checklist_items: [
            item("Site plan", "requested"),
            item("BASIX certificate", "submitted"),
            item("Structural drawings", "submitted", { amendments: [{ resolved: false }] }),
            item("Owner's consent", "approved"),
            item("Old note", "submitted", { amendments: [{ resolved: true }] }),
          ],
        },
      ],
      "CDC"
    );
    assert.equal(stages.length, 1);
    assert.deepEqual(
      stages[0].items.map((i) => [i.title, i.state]),
      [
        ["Site plan", "not_received"],
        ["BASIX certificate", "with_certifier"],
        ["Structural drawings", "needs_changes"],
        ["Old note", "with_certifier"],
      ]
    );
  });

  test("stages come in the order the job moves through them, and empty ones are left out", () => {
    const stages = outstandingStages(
      [
        { kind: "oc", checklist_items: [item("Final survey", "requested")] },
        { kind: "noc", checklist_items: [item("HBCF certificate", "approved")] },
        { kind: "modification", modification_id: "m1", checklist_items: [item("Amended plans", "requested")] },
        { kind: "pathway", checklist_items: [item("Site plan", "requested")] },
      ],
      "CC"
    );
    assert.deepEqual(
      stages.map((s) => s.label),
      ["CC application", "Modified CC", "Occupation Certificate"]
    );
    assert.equal(outstandingTotal(stages), 3);
  });

  test("a PC/OC job's first checklist is the approval someone else issued", () => {
    assert.equal(stageLabel("pathway", "PC_OC"), "Approval documents");
    assert.equal(stageLabel("pathway", "CDC"), "CDC application");
    assert.equal(stageLabel("modification", "CDC", 2), "Modified CDC 2");
  });

  test("the client's list leaves out internal items and anything already with the certifier", () => {
    const stages = outstandingStages(
      [
        {
          kind: "pathway",
          checklist_items: [item("Peer review", "requested", { internal: true }), item("Site plan", "submitted"), item("Survey", "requested")],
        },
        { kind: "noc", checklist_items: [item("Fee", "requested", { internal: true })] },
      ],
      "CDC"
    );
    assert.equal(outstandingTotal(stages), 4);
    const forClient = clientFacing(stages);
    assert.deepEqual(
      forClient.map((s) => s.items.map((i) => i.title)),
      [["Survey"]]
    );
  });
});

describe("writing the note", () => {
  const stages = [
    {
      key: "pathway",
      label: "CDC application",
      items: [
        { title: "Site plan", description: "A plan of the whole site.", state: "not_received" as const, internal: false },
        { title: "Structural drawings", description: null, state: "needs_changes" as const, internal: false },
      ],
    },
  ];

  test("the prompt carries the works and the documents, and nothing about the people", () => {
    const prompt = summaryPrompt({ pathway: "CDC", worksDescription: "New two-storey dwelling", stages });
    assert.ok(prompt.includes("New two-storey dwelling"));
    assert.ok(prompt.includes("- Site plan [not yet received] — A plan of the whole site."));
    assert.ok(prompt.includes("- Structural drawings [received, needs changes]"));
    assert.ok(prompt.includes("Stage: CDC application"));
  });

  test("the model's sentence sits beside each item; a title it invents goes nowhere", () => {
    const text = assembleSummary(stages, {
      intro: "Hello — a few things are still needed.",
      items: [
        { title: "site plan", whatIsNeeded: "Drawn by your designer, showing the whole block." },
        { title: "Bushfire report", whatIsNeeded: "Made up." },
      ],
      closing: "Thanks for your help.",
    });
    assert.ok(text.startsWith("Hello — a few things are still needed."));
    assert.ok(text.includes("• Site plan — Drawn by your designer, showing the whole block."));
    assert.ok(text.includes("• Structural drawings (needs changes) — Received, but it needs changes"));
    assert.ok(!text.includes("Bushfire report"), "a document the model added is not on the note");
    assert.ok(text.trim().endsWith("Thanks for your help."));
  });

  test("without the AI the library's own description is used, and standard words around it", () => {
    const text = assembleSummary(stages, null);
    assert.ok(text.startsWith("The following documents are still needed"));
    assert.ok(text.includes("• Site plan — A plan of the whole site."));
    assert.ok(text.includes("CDC application\n• Site plan"));
    assert.ok(text.includes("upload them straight into your portal"));
  });

  test("the email keeps the shape: headings, lists, paragraphs, and nothing unescaped", () => {
    const html = summaryToHtml("Hello <there>.\n\nCDC application\n• Site plan — A plan.\n• Survey — By a surveyor.\n\nThanks.");
    assert.equal(
      html,
      '<p>Hello &lt;there&gt;.</p><p style="margin-bottom:4px"><strong>CDC application</strong></p><ul style="margin-top:0"><li style="margin-bottom:2px">Site plan — A plan.</li><li style="margin-bottom:2px">Survey — By a surveyor.</li></ul><p>Thanks.</p>'
    );
  });

  test("an answer in the wrong shape is refused rather than sent", () => {
    assert.throws(() => parseWritten('{"intro":"x"}'), /expected shape/);
    const ok = parseWritten('{"intro":"a","closing":"b","items":[{"title":"T","whatIsNeeded":"W"},{"title":1}]}');
    assert.deepEqual(ok.items, [{ title: "T", whatIsNeeded: "W" }]);
  });

  test("the call asks for structured JSON and reads the text block back", async () => {
    let params: Record<string, unknown> | null = null;
    const fake: MessageCreator = {
      messages: {
        async create(p) {
          params = p as unknown as Record<string, unknown>;
          return {
            content: [
              { type: "thinking", thinking: "…", signature: "" },
              { type: "text", text: '{"intro":"Hi","closing":"Bye","items":[{"title":"Site plan","whatIsNeeded":"A plan."}]}' },
            ],
          } as unknown as Awaited<ReturnType<MessageCreator["messages"]["create"]>>;
        },
      },
    };
    const written = await askForDescriptions({ pathway: "CDC", worksDescription: null, stages }, fake);
    assert.equal(written.items[0].whatIsNeeded, "A plan.");
    const sent = params as unknown as { model: string; output_config: { format: { type: string } }; messages: { content: string }[] };
    assert.equal(sent.model, "claude-opus-5");
    assert.equal(sent.output_config.format.type, "json_schema");
    assert.ok(sent.messages[0].content.includes("Site plan"));
  });
});
