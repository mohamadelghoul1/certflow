import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { planUploads, uploadKey } from "@/lib/backup/syncPlan";
import { remotePath, needsRefresh, DROPBOX, ONEDRIVE } from "@/lib/backup/providers";

const candidate = (storagePath: string | null, folder: string, fileName: string, marker?: string) => ({ storagePath, folder, fileName, marker });

describe("planning a backup run", () => {
  // Our uploads are written to a new timestamped path every time, so a
  // path copied up once never needs copying again. That is what keeps a
  // nightly run to the day's new files.
  test("a file already sent is not sent again", () => {
    const plan = planUploads(
      [candidate("a/plans-v1.pdf", "02 Documents/01 Plans", "v1.pdf"), candidate("a/plans-v2.pdf", "02 Documents/01 Plans", "v2 (current).pdf")],
      [{ storage_path: "a/plans-v1.pdf" }],
      "/CertFlow",
      "CDC-26001 - 21 Coquet Way"
    );
    assert.deepEqual(plan.map((p) => p.storagePath), ["a/plans-v2.pdf"]);
  });

  test("the remote path is the firm's folder, the job, then where it belongs", () => {
    const [plan] = planUploads([candidate("a/x.pdf", "02 Documents/01 Plans", "v1.pdf")], [], "/CertFlow", "CDC-26001 - 21 Coquet Way");
    assert.equal(plan.remotePath, "/CertFlow/CDC-26001 - 21 Coquet Way/02 Documents/01 Plans/v1.pdf");
  });

  test("the same file reached twice on one job is sent once", () => {
    const plan = planUploads([candidate("a/x.pdf", "f", "x.pdf"), candidate("a/x.pdf", "f", "x.pdf")], [], "/CertFlow", "job");
    assert.equal(plan.length, 1);
  });

  // The approved set is rebuilt on demand and can genuinely change, so it
  // is remembered by what it is rather than by a path it doesn't have.
  test("a generated document is sent again only when it has changed", () => {
    const first = candidate(null, "01 Approval", "Approved Set.pdf", "signed-2026-08-25");
    const unchanged = planUploads([first], [{ storage_path: uploadKey(first) }], "/CertFlow", "job");
    assert.equal(unchanged.length, 0, "an unchanged approval is not sent again");

    const changed = candidate(null, "01 Approval", "Approved Set.pdf", "signed-2026-09-01");
    const after = planUploads([changed], [{ storage_path: uploadKey(first) }], "/CertFlow", "job");
    assert.equal(after.length, 1, "a reissued approval is");
  });
});

describe("remote paths", () => {
  test("stray separators from addresses and references are collapsed", () => {
    assert.equal(remotePath("/CertFlow/", "CDC-26001", "/02 Documents/", "v1.pdf"), "/CertFlow/CDC-26001/02 Documents/v1.pdf");
    assert.equal(remotePath("CertFlow", "job", "", "v1.pdf"), "/CertFlow/job/v1.pdf");
  });
});

describe("keeping a connection alive", () => {
  test("a token is refreshed before it expires, not after", () => {
    const now = new Date("2026-08-25T10:00:00Z");
    assert.equal(needsRefresh(new Date("2026-08-25T12:00:00Z"), now), false);
    assert.equal(needsRefresh(new Date("2026-08-25T10:02:00Z"), now), true, "inside the margin, so refresh now");
    assert.equal(needsRefresh(new Date("2026-08-25T09:59:00Z"), now), true, "already dead");
    assert.equal(needsRefresh(null, now), false, "a token with no expiry is left alone");
  });
});

describe("what each provider is asked to do", () => {
  // Without these, the provider returns a token that lasts hours and the
  // firm has to reconnect by hand every morning.
  test("both ask for a refresh token", () => {
    assert.match(DROPBOX.authorizeUrl({ clientId: "c", redirectUri: "https://x/cb", state: "s" }), /token_access_type=offline/);
    assert.match(ONEDRIVE.authorizeUrl({ clientId: "c", redirectUri: "https://x/cb", state: "s" }), /offline_access/);
  });

  test("the state is carried through, so a callback can be trusted", () => {
    assert.match(DROPBOX.authorizeUrl({ clientId: "c", redirectUri: "https://x/cb", state: "abc123" }), /state=abc123/);
    assert.match(ONEDRIVE.authorizeUrl({ clientId: "c", redirectUri: "https://x/cb", state: "abc123" }), /state=abc123/);
  });

  // A path with a space or a comma in it — every address has one — has to
  // survive the very different ways these two carry it.
  test("a path with spaces and commas survives both", () => {
    const path = "/CertFlow/CDC-26001 - 21 Coquet Way, Green Valley/02 Documents/v1.pdf";

    const dropbox = DROPBOX.uploadRequest({ accessToken: "t", remotePath: path, size: 10 });
    assert.equal(JSON.parse(dropbox.headers["Dropbox-API-Arg"]).path, path, "Dropbox carries it as JSON in a header");

    const onedrive = ONEDRIVE.uploadRequest({ accessToken: "t", remotePath: path, size: 10 });
    assert.ok(onedrive.url.includes("21%20Coquet%20Way%2C%20Green%20Valley"), "Graph carries it in the URL, so it must be escaped");
    assert.ok(!onedrive.url.includes("21 Coquet"), "an unescaped space would make a different URL");
    assert.ok(onedrive.url.startsWith("https://graph.microsoft.com/v1.0/me/drive/root:/CertFlow/"), "and the slashes stay slashes");
  });

  test("each knows the size its simple upload stops at", () => {
    assert.equal(DROPBOX.simpleUploadLimit, 150 * 1024 * 1024);
    assert.equal(ONEDRIVE.simpleUploadLimit, 4 * 1024 * 1024, "Graph's is far lower, which is why it cannot be assumed");
  });
});
