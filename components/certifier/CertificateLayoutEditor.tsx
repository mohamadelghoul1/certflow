"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Plus, RotateCcw, X } from "lucide-react";
import { saveCertificateTemplate, resetCertificateTemplate } from "@/lib/actions/certificateTemplates";
import { DEFAULT_TEMPLATES, templateProblems, type CertificateTemplate, type TemplateSection } from "@/lib/certificates/certificateTemplate";
import { FIELDS_FOR_PATHWAY, FIELD_NAMES, isRequired, type CertificatePathway, type FieldKey } from "@/lib/certificates/templateFields";
import type { ActionState } from "@/lib/actions/auth";

// A firm's own certificate layout.
//
// Every firm uses Certlyn's layout until it presses Customise, and
// pressing it copies that layout rather than opening a blank page —
// there is no version of this where a firm has to build a statutory
// certificate from nothing.
//
// Rows the Regulation requires are shown with their remove button gone
// rather than hidden, so it is clear they are there on purpose and can
// still be renamed.

export function CertificateLayoutEditor({
  pathway,
  custom,
  platformOwner = false,
  template,
}: {
  pathway: CertificatePathway;
  custom: boolean;
  // The firm that runs Certlyn can publish this layout as the one every
  // other firm starts from.
  platformOwner?: boolean;
  template: CertificateTemplate;
}) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<TemplateSection[]>(template.sections);
  const [saveState, save, saving] = useActionState<ActionState, FormData>(saveCertificateTemplate, undefined);
  const [resetState, reset, resetting] = useActionState<ActionState, FormData>(resetCertificateTemplate, undefined);

  const problems = templateProblems({ pathway, sections });
  const label =
    pathway === "CDC" ? "Complying Development Certificate" : pathway === "CC" ? "Construction Certificate" : "Occupation Certificate";
  // Only what this certificate has something to put in: a CDC's date of
  // lapse on an Occupation Certificate is a row that can only ever be
  // blank.
  const available = FIELDS_FOR_PATHWAY[pathway];

  function edit(next: TemplateSection[]) {
    setSections(next);
  }

  function moveRow(s: number, r: number, by: number) {
    const rows = [...sections[s].rows];
    const to = r + by;
    if (to < 0 || to >= rows.length) return;
    [rows[r], rows[to]] = [rows[to], rows[r]];
    edit(sections.map((sec, i) => (i === s ? { ...sec, rows } : sec)));
  }

  function moveSection(s: number, by: number) {
    const to = s + by;
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[s], next[to]] = [next[to], next[s]];
    edit(next);
  }

  return (
    <div className="border border-line rounded-md">
      <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <FileText size={15} className="text-placeholder shrink-0" />
          <span className="font-semibold text-heading">{label}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${custom ? "bg-warning-bg text-warning-text" : "bg-surface text-muted"}`}>
            {custom ? "Your own layout" : "Certlyn's standard layout"}
          </span>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-secondary hover:underline">
          {open ? "Close" : custom ? "Edit layout" : "Customise"}
        </button>
      </div>

      {open && (
        <div className="border-t border-line p-4 space-y-4">
          <p className="text-xs text-muted">
            The rows below are what prints on the certificate, in this order. Rename a label, drop a row you don&rsquo;t use, or add one of your own.
            A few rows are required on every {pathway} and can be renamed but not removed.
          </p>

          {sections.map((section, s) => (
            <div key={s} className="border border-line rounded-md p-3 bg-surface">
              <div className="flex items-center gap-2 mb-2">
                <input
                  value={section.heading}
                  onChange={(e) => edit(sections.map((sec, i) => (i === s ? { ...sec, heading: e.target.value } : sec)))}
                  className="flex-1 min-w-0 border border-line rounded px-2 py-1.5 text-xs font-semibold bg-white uppercase"
                />
                <Mover onUp={() => moveSection(s, -1)} onDown={() => moveSection(s, 1)} />
                <button
                  type="button"
                  onClick={() => edit(sections.filter((_, i) => i !== s))}
                  title="Remove this section"
                  className="text-error hover:opacity-70 shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-1.5">
                {section.rows.map((row, r) => {
                  const locked = row.source !== "fixed" && isRequired(pathway, row.source);
                  return (
                    <div key={r} className="flex items-center gap-2 flex-wrap">
                      <input
                        value={row.label}
                        onChange={(e) =>
                          edit(sections.map((sec, i) => (i === s ? { ...sec, rows: sec.rows.map((x, j) => (j === r ? { ...x, label: e.target.value } : x)) } : sec)))
                        }
                        placeholder="Label on the certificate"
                        className="flex-1 min-w-[10rem] border border-line rounded px-2 py-1.5 text-xs bg-white"
                      />
                      <select
                        value={row.source}
                        onChange={(e) =>
                          edit(
                            sections.map((sec, i) =>
                              i === s ? { ...sec, rows: sec.rows.map((x, j) => (j === r ? { ...x, source: e.target.value as FieldKey | "fixed" } : x)) } : sec,
                            ),
                          )
                        }
                        disabled={locked}
                        className="min-w-[11rem] border border-line rounded px-2 py-1.5 text-xs bg-white disabled:opacity-60"
                      >
                        {available.map((key) => (
                          <option key={key} value={key}>
                            {FIELD_NAMES[key]}
                          </option>
                        ))}
                        <option value="fixed">— Wording of my own —</option>
                      </select>
                      {row.source === "fixed" && (
                        <input
                          value={row.fixedValue || ""}
                          onChange={(e) =>
                            edit(
                              sections.map((sec, i) =>
                                i === s ? { ...sec, rows: sec.rows.map((x, j) => (j === r ? { ...x, fixedValue: e.target.value } : x)) } : sec,
                              ),
                            )
                          }
                          placeholder="What this row says"
                          className="flex-1 min-w-[10rem] border border-line rounded px-2 py-1.5 text-xs bg-white"
                        />
                      )}
                      <label className="flex items-center gap-1 text-[10px] text-muted shrink-0" title="Leave this row off the certificate when it has no value">
                        <input
                          type="checkbox"
                          checked={row.hideWhenEmpty === true}
                          onChange={(e) =>
                            edit(
                              sections.map((sec, i) =>
                                i === s ? { ...sec, rows: sec.rows.map((x, j) => (j === r ? { ...x, hideWhenEmpty: e.target.checked } : x)) } : sec,
                              ),
                            )
                          }
                        />
                        Hide if blank
                      </label>
                      <Mover onUp={() => moveRow(s, r, -1)} onDown={() => moveRow(s, r, 1)} />
                      {locked ? (
                        <span className="text-[10px] text-placeholder shrink-0 w-14 text-center">Required</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => edit(sections.map((sec, i) => (i === s ? { ...sec, rows: sec.rows.filter((_, j) => j !== r) } : sec)))}
                          title="Remove this row"
                          className="text-error hover:opacity-70 shrink-0 w-14 text-center"
                        >
                          <X size={13} className="inline" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => edit(sections.map((sec, i) => (i === s ? { ...sec, rows: [...sec.rows, { source: "fixed", label: "", fixedValue: "" }] } : sec)))}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-secondary hover:underline"
              >
                <Plus size={12} /> Add a row
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => edit([...sections, { heading: "NEW SECTION", rows: [] }])}
            className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
          >
            <Plus size={13} /> Add a section
          </button>

          {problems.length > 0 && (
            <ul className="text-[11px] text-error bg-error-bg rounded-md px-3 py-2 space-y-1">
              {problems.map((problem, i) => (
                <li key={i}>{problem}</li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3 flex-wrap border-t border-line pt-3">
            <form action={save}>
              <input type="hidden" name="pathway" value={pathway} />
              <input type="hidden" name="layout" value={JSON.stringify(sections)} />
              <button
                disabled={saving || problems.length > 0}
                className="bg-primary text-white rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-primary-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save this layout"}
              </button>
            </form>

            {/* Publishing the layout, not just saving it. Separate from
                Save so nobody changes every firm's certificate while
                meaning to change their own — and only offered to the
                firm that runs Certlyn. */}
            {platformOwner && (
              <form
                action={save}
                onSubmit={(e) => {
                  if (!confirm(`Make this the standard ${pathway} layout for every firm on Certlyn? Firms that have saved a layout of their own keep theirs.`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="pathway" value={pathway} />
                <input type="hidden" name="layout" value={JSON.stringify(sections)} />
                <input type="hidden" name="scope" value="platform" />
                <button
                  disabled={saving || problems.length > 0}
                  className="border border-primary text-primary rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-hover disabled:opacity-60"
                >
                  Save as the standard for every firm
                </button>
              </form>
            )}

            <button type="button" onClick={() => setSections(DEFAULT_TEMPLATES[pathway].sections)} className="text-xs text-secondary hover:underline">
              Start again from Certlyn&rsquo;s layout
            </button>

            {custom && (
              <form action={reset} className="ml-auto">
                <input type="hidden" name="pathway" value={pathway} />
                <button disabled={resetting} className="inline-flex items-center gap-1 text-xs font-semibold text-error hover:underline disabled:opacity-60">
                  <RotateCcw size={12} /> {resetting ? "Undoing…" : "Go back to the standard layout"}
                </button>
              </form>
            )}
          </div>

          {(saveState?.error || resetState?.error) && <div className="text-[11px] text-error">{saveState?.error || resetState?.error}</div>}
          <p className="text-[11px] text-placeholder">
            Changing this changes what your certificates say. It applies to certificates generated from now on — anything already issued keeps the
            layout it was issued under.
          </p>
        </div>
      )}
    </div>
  );
}

function Mover({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <div className="flex flex-col shrink-0">
      <button type="button" onClick={onUp} title="Move up" className="text-placeholder hover:text-primary">
        <ChevronUp size={13} />
      </button>
      <button type="button" onClick={onDown} title="Move down" className="text-placeholder hover:text-primary">
        <ChevronDown size={13} />
      </button>
    </div>
  );
}
