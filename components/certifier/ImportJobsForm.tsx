"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Check, AlertTriangle, Upload } from "lucide-react";
import { importJobs, type ImportResult } from "@/lib/actions/importJobs";
import { parsePaste } from "@/lib/import/parseTable";
import { buildPreview, looksLikeHeadings } from "@/lib/import/jobRows";
import { FIELD_LABELS, type JobField } from "@/lib/import/jobColumns";

// Moving a firm's existing jobs across from whatever they used before.
//
// The preview is worked out here in the browser rather than on the
// server: the reading is pure, so the certifier sees what each column
// was taken to mean the moment they paste, and can fix their spreadsheet
// and paste again without a round trip or a half-finished import.

const inputCls = "w-full px-3 py-2 rounded-md border border-line text-sm outline-none focus:ring-2 focus:ring-icon";

export function ImportJobsForm({ certifiers }: { certifiers: { id: string; name: string }[] }) {
  const certifierNames = useMemo(() => certifiers.map((c) => c.name), [certifiers]);
  const [pasted, setPasted] = useState("");
  const [certifierId, setCertifierId] = useState(certifiers[0]?.id || "");
  const [state, formAction, pending] = useActionState<ImportResult | undefined, FormData>(importJobs, undefined);

  const preview = useMemo(() => {
    const paste = parsePaste(pasted, looksLikeHeadings);
    if (!paste) return null;
    return buildPreview(paste, certifierNames);
  }, [pasted, certifierNames]);

  const readyCount = preview?.jobs.filter((job) => job.address).length || 0;

  // One chip per column: its heading where there was one, otherwise its
  // position, and what CertFlow took it to mean.
  const columnLabels = useMemo(() => {
    if (!preview) return [];
    const width = preview.headers ? preview.headers.length : Math.max(...preview.jobs.map((_, i) => i), 0, ...[0]);
    const count = preview.headers ? width : Math.max(...Object.values(preview.matched).map((i) => i + 1), 0);
    return Array.from({ length: count }, (_, i) => ({
      label: preview.headers ? preview.headers[i] || "(blank)" : `Column ${i + 1}`,
      field: (Object.keys(preview.matched) as JobField[]).find((key) => preview.matched[key] === i),
    }));
  }, [preview]);

  if (state?.created !== undefined) {
    return (
      <div className="bg-white rounded-lg border border-line p-6 max-w-3xl">
        <div className="flex items-center gap-2 text-accent font-bold mb-2">
          <Check size={18} /> {state.created} {state.created === 1 ? "project" : "projects"} imported
        </div>
        <p className="text-sm text-muted mb-4">
          Each one came in as a Principal Certifier / OC project, with the previous certifier&rsquo;s approval recorded, the standard inspections ready, and its checklists set up.
        </p>
        {(state.skipped?.length || 0) > 0 && (
          <div className="mb-4">
            <div className="text-sm font-semibold text-warning-text mb-1">{state.skipped!.length} not imported:</div>
            <ul className="text-xs text-muted list-disc pl-5 space-y-0.5">
              {state.skipped!.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <Link href="/jobs" className="inline-block px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
          See your projects
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5 max-w-5xl">
      <input type="hidden" name="pasted" value={pasted} />

      <div className="bg-white rounded-lg border border-line p-5">
        <label className="block text-sm font-semibold text-primary mb-1">Paste your projects</label>
        <p className="text-xs text-muted mb-3">
          Export a list from your current system, open it, select everything including the heading row, copy, and paste it here. The column headings can say whatever they already say —
          CertFlow works out what they mean.
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={8}
          placeholder="Site Address	Scope of Works	Lot/DP	Council	Client	CDC Number …"
          className={`${inputCls} font-mono text-xs`}
        />
      </div>

      {preview && (
        <div className="bg-white rounded-lg border border-line p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold text-primary mb-2">What CertFlow read</div>
            {preview.inferred && (
              <p className="text-[11px] text-warning-text mb-2">
                No heading row, so the columns were read from the values themselves. Check the table below before importing — and if anything is wrong, paste the heading row too and it
                will be read from that instead.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {columnLabels.map(({ label, field }, i) => (
                <span
                  key={i}
                  className={`px-2 py-1 rounded text-[11px] font-medium border ${field ? "bg-success-bg text-accent border-success/40" : "bg-hover text-placeholder border-line"}`}
                  title={field ? `Imported as ${FIELD_LABELS[field]}` : "Not imported"}
                >
                  {label} {field ? `→ ${FIELD_LABELS[field]}` : "→ not imported"}
                </span>
              ))}
            </div>
            {preview.unmatchedHeadings.length > 0 && (
              <p className="text-[11px] text-placeholder mt-2">
                Columns marked &ldquo;not imported&rdquo; are left behind — nothing is lost from your own system, and you can add those details to a project afterwards.
              </p>
            )}
          </div>

          <div>
            <div className="text-sm font-semibold text-primary mb-2">
              {readyCount} {readyCount === 1 ? "project" : "projects"} ready to import
            </div>
            <div className="rounded-md border border-line overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-heading text-white sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Address</th>
                    <th className="px-3 py-2 text-left font-semibold">Scope</th>
                    <th className="px-3 py-2 text-left font-semibold">Approval</th>
                    <th className="px-3 py-2 text-left font-semibold">Needs attention</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.jobs.map((job) => (
                    <tr key={job.rowNumber} className="border-t border-line align-top">
                      <td className="px-3 py-2 text-primary font-medium">{job.address || <span className="text-error">no address — skipped</span>}</td>
                      <td className="px-3 py-2 text-muted">{job.description}</td>
                      <td className="px-3 py-2 text-muted">{job.details.priorApproval?.number || "—"}</td>
                      <td className="px-3 py-2 text-placeholder">
                        {job.warnings.length === 0 ? (
                          <span className="text-accent">Complete</span>
                        ) : (
                          <span className="inline-flex items-start gap-1">
                            <AlertTriangle size={11} className="text-warning-text mt-0.5 shrink-0" />
                            {job.warnings.join("; ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-placeholder mt-2">
              A project missing something still imports — the gap is yours to fill on the project itself, and CertFlow asks for anything genuinely required again before an Occupation
              Certificate can be issued.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-line p-5">
        <label className="block text-sm font-semibold text-primary mb-1">Assign these projects to</label>
        <select name="assigned_certifier_id" value={certifierId} onChange={(e) => setCertifierId(e.target.value)} className={`${inputCls} sm:w-80`}>
          {certifiers.map((certifier) => (
            <option key={certifier.id} value={certifier.id}>
              {certifier.name}
            </option>
          ))}
        </select>
      </div>

      {state?.error && <div className="text-sm text-error font-medium">{state.error}</div>}

      <div className="flex items-center gap-3">
        <button
          disabled={pending || readyCount === 0 || !certifierId}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-40"
        >
          <Upload size={15} />
          {pending ? "Importing…" : `Import ${readyCount || ""} ${readyCount === 1 ? "project" : "projects"}`.trim()}
        </button>
        <Link href="/jobs" className="text-sm text-muted hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
