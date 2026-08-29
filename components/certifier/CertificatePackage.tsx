"use client";

import { Suspense, useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { AutoPrint } from "@/components/certifier/AutoPrint";
import { DownloadButton } from "@/components/certifier/DownloadButton";
import type { ActionState } from "@/lib/actions/auth";

// Its own component (rather than inline in the toolbar) because the
// signing hooks must run unconditionally, and signAction is only present
// for documents that support signing.
//
// Signing is three quick row updates, but the press used to wait on the
// whole page being re-rendered and streamed back before the button
// changed. It flips the moment it is pressed instead, the way approving a
// checklist item does; if the update fails, React drops the optimistic
// value, the button comes back, and the error is shown beside it.
function SignButton({
  signAction,
  unsignAction,
  signFields,
  signed,
  signedLabel,
}: {
  signAction: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  // Offered only where a signed document can be corrected and signed
  // again — an inspection report. A certificate is reissued as a new
  // version instead, so it has none.
  unsignAction?: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  signFields?: Record<string, string>;
  signed?: boolean;
  signedLabel?: string;
}) {
  const [optimisticSigned, setOptimisticSigned] = useOptimistic(!!signed);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (next: boolean, action: (prev: undefined, fd: FormData) => Promise<ActionState>) =>
    startTransition(async () => {
      setError(null);
      setOptimisticSigned(next);
      const fd = new FormData();
      Object.entries(signFields || {}).forEach(([k, v]) => fd.set(k, v));
      const result = await action(undefined, fd);
      if (result?.error) setError(result.error);
    });

  if (optimisticSigned) {
    return (
      <div className="flex items-center gap-2">
        {/* The label carries the date the server recorded, which doesn't
            exist yet in the moment between the press and the save — so
            until it does, this says simply "Signed". */}
        <span className="px-3 py-2 rounded-md bg-success-bg text-success text-sm font-semibold">{(signed && signedLabel) || "Signed"}</span>
        {unsignAction && (
          <button type="button" onClick={() => run(false, unsignAction)} className="text-xs font-semibold text-secondary hover:underline">
            Reopen to edit
          </button>
        )}
        {error && <span className="text-xs text-error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => run(true, signAction)} className="px-4 py-2 rounded-md bg-success text-white text-sm font-semibold hover:bg-success">
        Sign
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  );
}

// Wraps the whole letter/certificate package: a print:hidden toolbar (back
// link, Print where the document offers it, Export as Word) plus the
// document itself.
//
// "Export as Word" links straight to a route under app/api/ that builds a
// genuine .docx server-side (lib/docx/) — native page breaks, table
// borders, and image sizing, none of which depend on Word's notoriously
// inconsistent legacy HTML importer. An earlier version of this component
// instead cloned the live DOM, inlined every computed style, and disguised
// the result as a .doc; that approach surfaced a new Word-HTML-import quirk
// (page breaks, table borders, fonts, image sizing) almost every round it
// was tested against a real export, including one boundary case that never
// got fully resolved despite several targeted attempts — see git history on
// this file if any of that ever needs resurrecting.
//
// signAction (optional) turns on the review-then-sign workflow shared by
// every generated document: export to Word to check/amend the text, then
// press Sign once it's ready. Until signed, the certifier's signature image
// is never inserted (the page passing signatureUrl is responsible for that
// gating) — this component only renders the Sign button/banner. Once
// signed, "Export as Word" is hidden — the document is final at that point,
// so re-exporting an editable copy no longer makes sense.
//
// uploadAction (optional) is the answer to "how do I get my Word edits back
// into Certlyn": there is no live connection between a downloaded file
// open in Word and this page — Word can't notify a website when you press
// Save. Exporting, editing, and re-uploading the finished file here is the
// actual mechanism, so it lives right next to Export/Sign instead of buried
// elsewhere in the app.
export function CertificatePackage({
  backHref,
  wordExportHref,
  pdfHref,
  children,
  allowPrint = true,
  signed,
  signedLabel,
  signAction,
  unsignAction,
  signFields,
  uploadAction,
  uploadFields,
  uploadPathPrefix,
  uploadedUrl,
}: {
  backHref: string;
  wordExportHref: string;
  /* A route that builds this document as a PDF, downloaded straight to
     the certifier's machine. Where it exists it replaces the browser's
     print dialog entirely: the file is laid out by Certlyn rather than
     by whatever print engine the browser happens to have. */
  pdfHref?: string;
  children: React.ReactNode;
  /* Whether this document offers "Save as PDF". The approval turns
     it off: it goes out as the Word export or as the full approved set
     PDF, both laid out by Certlyn, rather than as whatever the browser's
     own print engine makes of the page. */
  allowPrint?: boolean;
  signed?: boolean;
  signedLabel?: string;
  signAction?: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  unsignAction?: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  signFields?: Record<string, string>;
  uploadAction?: (formData: FormData) => Promise<void>;
  uploadFields?: Record<string, string>;
  uploadPathPrefix?: string;
  uploadedUrl?: string | null;
}) {
  const canExportWord = !signAction || !signed;

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      {allowPrint && (
        <Suspense fallback={null}>
          <AutoPrint />
        </Suspense>
      )}
      <div className="max-w-3xl mx-auto py-6 px-4 print:hidden flex items-center justify-between flex-wrap gap-2">
        <Link href={backHref} className="text-sm text-placeholder hover:text-primary">
          ← Back to project
        </Link>
        <div className="flex items-center gap-2">
          {pdfHref ? (
            <DownloadButton href={pdfHref} fallbackName="Report.pdf" className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 inline-flex items-center gap-1.5">
              Download PDF
            </DownloadButton>
          ) : (
            allowPrint && (
              <button onClick={() => window.print()} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
                Save as PDF
              </button>
            )
          )}
          {canExportWord && (
            <a href={wordExportHref} className="px-4 py-2 rounded-md border border-primary text-primary text-sm font-semibold hover:bg-hover">
              Export as Word
            </a>
          )}
          {signAction && <SignButton signAction={signAction} unsignAction={unsignAction} signFields={signFields} signed={signed} signedLabel={signedLabel} />}
        </div>
      </div>
      {uploadAction && uploadPathPrefix && (
        <div className="max-w-3xl mx-auto px-4 print:hidden -mt-3 mb-4 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-placeholder">Edited this in Word and want your changes reflected here? Upload the finished file:</span>
          <ActionUpload action={uploadAction} fields={uploadFields || {}} pathPrefix={uploadPathPrefix} label={uploadedUrl ? "Replace uploaded copy" : "Upload edited/signed copy"} />
          {uploadedUrl && (
            <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-xs text-secondary hover:underline">
              View uploaded copy
            </a>
          )}
        </div>
      )}
      {signAction && !signed && (
        <div className="max-w-3xl mx-auto px-4 print:hidden -mt-3 mb-4">
          <div className="text-xs text-warning-text bg-warning-bg border border-warning/50 rounded-md px-3 py-2">
            Not yet signed — the signature line below is blank. Export to Word first if you need to amend anything, then press Sign once it&apos;s ready.
          </div>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
