import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { fillWording, paragraphsOf, firmWording, WORDING_FIELDS, PLACEHOLDERS } from "@/lib/certificates/documentWording";

// A firm's own words on its statutory letters. Three layers — this job,
// this firm, then Certlyn — and the one that matters most is the third:
// a firm that has written nothing must print exactly what it printed
// before any of this existed.

const VALUES = {
  FIRM: "Quality Private Certifiers Pty Ltd",
  CERTIFIER: "Mohamad El Ghoul",
  ADDRESS: "21 Coquet Way, Green Valley",
  COUNCIL: "Liverpool City Council",
  PATHWAY: "Complying Development Certificate",
};

describe("a firm's own approval wording", () => {
  test("a firm that has written nothing gets nothing, so the caller keeps its default", () => {
    assert.equal(firmWording({}, "council.body", VALUES), null);
    assert.equal(firmWording(null, "council.body", VALUES), null);
    assert.equal(firmWording({ "council.body": "   " }, "council.body", VALUES), null);
  });

  test("a firm's own words reach the letter, with the job's facts filled in", () => {
    const saved = { "council.body": "{FIRM} has issued this for {ADDRESS}.\n\nAsk for {CERTIFIER}." };
    assert.deepEqual(firmWording(saved, "council.body", VALUES), [
      "Quality Private Certifiers Pty Ltd has issued this for 21 Coquet Way, Green Valley.",
      "Ask for Mohamad El Ghoul.",
    ]);
  });

  test("a blank line is a new paragraph, however much space is around it", () => {
    assert.deepEqual(paragraphsOf("One.\n\n\n  \n Two.  \n\nThree."), ["One.", "Two.", "Three."]);
  });

  // A letter reading "contact —" is visibly unfinished. One reading
  // "contact {CERTIFIER}" looks like the software is broken, and one
  // with a silent gap looks deliberate.
  test("a placeholder with nothing behind it becomes a dash, not its own name", () => {
    assert.equal(fillWording("Contact {CERTIFIER}.", { CERTIFIER: "" }), "Contact —.");
    assert.equal(fillWording("Contact {CERTIFIER}.", { CERTIFIER: null }), "Contact —.");
  });

  // Something a certifier typed that Certlyn does not recognise is left
  // alone rather than blanked: they can see what they wrote and fix it.
  test("a placeholder Certlyn does not know is left as typed", () => {
    assert.equal(fillWording("Ref {INVOICE NUMBER} here.", VALUES), "Ref {INVOICE NUMBER} here.");
  });

  test("every document offered for editing starts from real wording, not an empty box", () => {
    for (const field of WORDING_FIELDS) {
      assert.ok(field.starting.trim().length > 40, `${field.key} has no starting text`);
      assert.ok(field.label && field.help, `${field.key} is missing its label or help`);
    }
  });

  // The editor lists the placeholders; the filler has to honour the same
  // ones, or a certifier follows the list and gets literal braces on a
  // statutory letter.
  test("every placeholder the editor advertises is one the filler replaces", () => {
    for (const { token } of PLACEHOLDERS) {
      const name = token.slice(1, -1);
      assert.equal(fillWording(token, { [name]: "filled" }), "filled", `${token} is advertised but not replaced`);
    }
  });

  test("the starting text only uses placeholders that are advertised", () => {
    const known = new Set(PLACEHOLDERS.map((p) => p.token.slice(1, -1)));
    for (const field of WORDING_FIELDS) {
      for (const [, token] of field.starting.matchAll(/\{([A-Z ]+)\}/g)) {
        assert.ok(known.has(token), `${field.key} uses {${token}}, which is not on the list a certifier is shown`);
      }
    }
  });
});
