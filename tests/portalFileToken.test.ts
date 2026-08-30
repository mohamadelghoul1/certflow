import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { portalFileToken, verifyPortalFileToken, eplanningDocId, verifyEplanningDocId } from "@/lib/portal/files";

// These links carry their own authority: whoever holds one gets the file
// it names, with no login in between. So the seal is the whole of the
// security, and the ways it can quietly stop being a seal are what
// matter.

function withSecret<T>(value: string | undefined, run: () => T): T {
  const before = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (value === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = value;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = before;
  }
}

describe("the links that carry their own authority", () => {
  test("a link made by the server opens the file it names", () => {
    withSecret("a-real-key", () => {
      assert.equal(verifyPortalFileToken(portalFileToken("firm/job/report.pdf")), "firm/job/report.pdf");
    });
  });

  test("a tampered path is refused", () => {
    withSecret("a-real-key", () => {
      const token = portalFileToken("firm/job/report.pdf");
      const [, signature] = token.split(".");
      const forgedPayload = Buffer.from(JSON.stringify({ p: "other-firm/private.pdf", e: 9999999999 })).toString("base64url");
      assert.equal(verifyPortalFileToken(`${forgedPayload}.${signature}`), null);
    });
  });

  test("an expired link is refused", () => {
    withSecret("a-real-key", () => {
      assert.equal(verifyPortalFileToken(portalFileToken("firm/job/report.pdf", -1)), null);
    });
  });

  // The one that mattered. An HMAC over a missing key still computes —
  // over the empty string — and produces a signature anyone can work out
  // for a path of their choosing. A misconfigured deployment would have
  // turned every document in the system into a public file, with nothing
  // to notice it by.
  test("without its secret it refuses rather than sealing with nothing", () => {
    withSecret(undefined, () => {
      assert.throws(() => portalFileToken("firm/job/report.pdf"), /SUPABASE_SERVICE_ROLE_KEY/);
      assert.throws(() => eplanningDocId("firm/job/report.pdf"), /SUPABASE_SERVICE_ROLE_KEY/);
    });
  });

  test("and a link minted while the secret was set stops opening once it is gone", () => {
    const token = withSecret("a-real-key", () => portalFileToken("firm/job/report.pdf"));
    const docId = withSecret("a-real-key", () => eplanningDocId("firm/job/report.pdf"));
    withSecret(undefined, () => {
      assert.equal(verifyPortalFileToken(token), null);
      assert.equal(verifyEplanningDocId(docId), null);
    });
  });

  test("an ePlanning id survives the round trip and refuses a tampered one", () => {
    withSecret("a-real-key", () => {
      const id = eplanningDocId("firm/job/plan.pdf");
      assert.equal(verifyEplanningDocId(id), "firm/job/plan.pdf");
      assert.equal(verifyEplanningDocId(`${id}x`), null);
    });
  });
});
