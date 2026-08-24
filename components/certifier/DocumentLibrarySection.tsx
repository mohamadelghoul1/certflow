"use client";

import { useState } from "react";
import { Download, Paperclip } from "lucide-react";
import { addLibraryItem, removeLibraryItem, setLibraryTemplate, clearLibraryTemplate } from "@/lib/actions/library";
import { ActionUpload } from "@/components/certifier/ActionUpload";

type LibItem = {
  id: string;
  pathway: string;
  title: string;
  description: string | null;
  category: string | null;
  template_file_name: string | null;
};

const PATHWAYS: { key: string; label: string }[] = [
  { key: "CDC", label: "CDC" },
  { key: "CC", label: "CC" },
  { key: "NOC", label: "Notice of Commencement" },
  { key: "OC", label: "Occupation Certificate" },
];

export function DocumentLibrarySection({
  items,
  firmId,
  templateUrls,
}: {
  items: LibItem[];
  firmId: string;
  // Signed download links for the blank forms already attached, keyed by
  // library item id. Built on the server — a signed URL can't be made from
  // the browser.
  templateUrls: Record<string, string>;
}) {
  const [active, setActive] = useState<string | null>(null);
  const grouped = active ? items.filter((i) => i.pathway === active) : [];

  return (
    <div>
      <p className="text-xs text-placeholder mb-3">
        These are the documents new projects start with, and what shows up in &ldquo;+ Request documents&rdquo; on every project. Edit this once — no need to type the same items in per project.
      </p>
      <p className="text-xs text-placeholder mb-3">
        Attach your own blank form to any item — the contract, an application form, the notice of commencement — and the client gets a
        &ldquo;Download blank form&rdquo; link beside it in their portal, on every project. Replace it here and every project picks up the new
        version straight away.
      </p>
      <div className="flex gap-2 mb-4">
        {PATHWAYS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActive(active === p.key ? null : p.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${active === p.key ? "bg-primary text-white" : "border border-line text-muted hover:bg-hover"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!active && <div className="text-sm text-placeholder">Select CDC, CC, Notice of Commencement, or Occupation Certificate above to view or edit its documents.</div>}

      {active && (
        <>
          <div className="space-y-2 mb-3">
            {grouped.map((item) => (
              <div key={item.id} className="border border-line rounded-md px-4 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary">{item.title}</div>
                    <div className="text-xs text-placeholder">{item.description}</div>
                  </div>
                  <form action={removeLibraryItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="text-xs text-error hover:underline shrink-0">Remove</button>
                  </form>
                </div>

                <div className="mt-2 pt-2 border-t border-line flex flex-wrap items-center gap-3">
                  {item.template_file_name ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted min-w-0">
                        <Paperclip size={12} className="shrink-0 text-icon" />
                        <span className="truncate">{item.template_file_name}</span>
                      </span>
                      {templateUrls[item.id] && (
                        <a
                          href={templateUrls[item.id]}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline"
                        >
                          <Download size={12} /> Download
                        </a>
                      )}
                      <ActionUpload
                        action={setLibraryTemplate}
                        fields={{ id: item.id }}
                        pathPrefix={`${firmId}/library/${item.id}`}
                        label="Replace blank form"
                      />
                      <form action={clearLibraryTemplate}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="text-xs text-error hover:underline">Remove form</button>
                      </form>
                    </>
                  ) : (
                    <ActionUpload
                      action={setLibraryTemplate}
                      fields={{ id: item.id }}
                      pathPrefix={`${firmId}/library/${item.id}`}
                      label="Attach blank form"
                    />
                  )}
                </div>
              </div>
            ))}
            {grouped.length === 0 && <div className="text-sm text-placeholder">No items yet for this checklist type.</div>}
          </div>
          <form action={addLibraryItem} className="flex gap-2">
            <input type="hidden" name="pathway" value={active} />
            <input name="title" placeholder="Document title" required className="flex-1 px-3 py-2 rounded-md border border-line text-sm" />
            <input name="description" placeholder="Description (optional)" className="flex-1 px-3 py-2 rounded-md border border-line text-sm" />
            <button className="px-3 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 shrink-0">Add</button>
          </form>
        </>
      )}
    </div>
  );
}
