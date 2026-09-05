import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { setupSteps, setupProgress, nextStep, type SetupFacts } from "@/lib/firmSetup";

const EMPTY: SetupFacts = {
  firmName: null,
  abn: null,
  officeAddress: null,
  phone: null,
  logoUrl: null,
  sendingAddressSet: false,
  certifiers: [],
  libraryItems: 0,
  clients: 0,
  jobs: 0,
  twoFactorOn: false,
};

const READY: SetupFacts = {
  firmName: "Example Certifiers Pty Ltd",
  abn: "12 345 678 901",
  officeAddress: "1 Sample Street, Parramatta NSW 2150",
  phone: "02 0000 0000",
  logoUrl: "firm/logo.png",
  sendingAddressSet: true,
  certifiers: [{ registrationNo: "BDC1234", signatureUrl: "firm/sig.png" }],
  libraryItems: 22,
  clients: 3,
  jobs: 5,
  twoFactorOn: true,
};

function byId(facts: SetupFacts, id: string) {
  const step = setupSteps(facts).find((s) => s.id === id);
  assert.ok(step, id + " should exist");
  return step;
}

describe("what a new firm still has to do", () => {
  test("a firm that has just been created has everything to do", () => {
    const steps = setupSteps(EMPTY);
    assert.equal(steps.every((s) => !s.done), true);
    assert.equal(setupProgress(steps).done, 0);
    assert.equal(setupProgress(steps).complete, false);
  });

  test("a firm that is set up is finished, and the panel disappears", () => {
    const steps = setupSteps(READY);
    assert.equal(steps.every((s) => s.done), true, JSON.stringify(steps.filter((s) => !s.done).map((s) => s.id)));
    assert.equal(setupProgress(steps).complete, true);
    assert.equal(setupProgress(steps).essentialLeft, 0);
    assert.equal(nextStep(steps), null);
  });
});

describe("the firm's own details", () => {
  test("are not done until all four are filled in", () => {
    assert.equal(byId({ ...READY, phone: null }, "firm").done, false);
    assert.equal(byId({ ...READY, abn: "   " }, "firm").done, false, "whitespace is not an ABN");
    assert.equal(byId(READY, "firm").done, true);
  });
});

describe("certifiers and their signatures", () => {
  test("a certifier with no registration number does not count", () => {
    const facts = { ...READY, certifiers: [{ registrationNo: null, signatureUrl: "sig.png" }] };
    assert.equal(byId(facts, "certifier").done, false);
  });

  test("every registered certifier needs a signature, not just one of them", () => {
    const facts = {
      ...READY,
      certifiers: [
        { registrationNo: "BDC1", signatureUrl: "a.png" },
        { registrationNo: "BDC2", signatureUrl: null },
      ],
    };
    assert.equal(byId(facts, "certifier").done, true, "there are registered certifiers");
    assert.equal(byId(facts, "signature").done, false, "one of them cannot sign anything");
  });

  test("signatures are not 'done' when there are no certifiers at all", () => {
    assert.equal(byId(EMPTY, "signature").done, false, "an empty list must not read as everyone having signed");
  });
});

describe("the sending address", () => {
  test("counts whether it is their own sending address or the firm's contact address", () => {
    assert.equal(byId({ ...READY, sendingAddressSet: false }, "email").done, false);
    assert.equal(byId(READY, "email").done, true);
  });
});

describe("what the panel leads with", () => {
  test("is an essential step while one is outstanding", () => {
    const steps = setupSteps({ ...READY, logoUrl: null, twoFactorOn: false });
    assert.equal(nextStep(steps)?.id, "logo", "the logo is essential; two-factor is not");
    assert.equal(setupProgress(steps).essentialLeft, 1);
  });

  test("falls through to the rest once the essentials are done", () => {
    const steps = setupSteps({ ...READY, twoFactorOn: false });
    assert.equal(setupProgress(steps).essentialLeft, 0);
    assert.equal(nextStep(steps)?.id, "two-factor");
  });

  test("every step points somewhere a person can act", () => {
    for (const step of setupSteps(EMPTY)) {
      assert.match(step.href, /^\/(settings|jobs)/, step.id);
      assert.ok(step.why.length > 20, step.id + " should say why it matters");
    }
  });
});
