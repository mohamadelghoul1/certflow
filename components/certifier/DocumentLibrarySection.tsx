"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Paperclip, GripVertical } from "lucide-react";
import { addLibraryItem, removeLibraryItem, reorderLibraryItems, copyLibraryItem, updateLibraryItem, setLibraryTemplate, clearLibraryTemplate } from "@/lib/actions/library";
import { ActionUpload } from "@/components/certifier/ActionUpload";
import { SubmitButton } from "@/components/SubmitButton";

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
  // Drag-to-reorder: the list is reshuffled live while a card is held,
  // and the final order is written once on drop. Local order wins over
  // the server's until the save lands, so nothing snaps back.
  const [dragId, setDragId] = useState<string | null>(null);
  const [orderIds, setOrderIds] = useState<string[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  // A press outside fires both the pointer watcher and the blur handler;
  // one save, not two.
  const editSubmittedRef = useRef(false);

  // Any press outside the open edit boxes saves them — blur alone misses
  // taps on empty space, which move no focus on a touch screen.
  useEffect(() => {
    if (!editingId) return;
    editSubmittedRef.current = false;
    function onPointerDown(e: PointerEvent) {
      if (editSubmittedRef.current) return;
      if (editFormRef.current && !editFormRef.current.contains(e.target as Node)) {
        editSubmittedRef.current = true;
        editFormRef.current.requestSubmit();
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editingId]);

  const grouped = active ? items.filter((i) => i.pathway === active) : [];
  // An item added after a drag isn't in the dragged order yet — it joins
  // at the end rather than vanishing.
  const displayed = orderIds
    ? ([...orderIds.map((id) => grouped.find((i) => i.id === id)).filter(Boolean), ...grouped.filter((i) => !orderIds.includes(i.id))] as LibItem[])
    : grouped;

  function dragOver(overId: string) {
    if (!dragId || dragId === overId) return;
    const ids = (orderIds || grouped.map((i) => i.id)).filter((id) => id !== dragId);
    const at = ids.indexOf(overId);
    if (at < 0) return;
    // Dropping on a card takes its place; everything else shuffles round.
    const held = ids.slice(0, at).concat(dragId, ids.slice(at));
    setOrderIds(held);
  }

  function dragEnd() {
    if (dragId && orderIds) {
      const form = new FormData();
      form.set("ids", JSON.stringify(orderIds));
      void reorderLibraryItems(form);
    }
    setDragId(null);
  }

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
            onClick={() => {
              setActive(active === p.key ? null : p.key);
              setOrderIds(null);
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${active === p.key ? "bg-primary text-white" : "border border-line text-muted hover:bg-hover"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!active && <div className="text-sm text-placeholder">Select CDC, CC, Notice of Commencement, or Occupation Certificate above to view or edit its documents.</div>}

      {active && (
        <>
          <p className="text-[11px] text-placeholder mb-2">Drag a document up or down to change the order — on a phone, hold the grip beside its name. Saved as you drop it.</p>
          <div className="space-y-2 mb-3">
            {displayed.map((item) => (
              <div
                key={item.id}
                data-lib-id={item.id}
                draggable
                onDragStart={(e) => {
                  setDragId(item.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  dragOver(item.id);
                }}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={dragEnd}
                className={`border border-line rounded-md px-4 py-2.5 bg-white cursor-grab active:cursor-grabbing ${dragId === item.id ? "opacity-60 border-icon shadow-md" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className="shrink-0 mt-0.5 -m-1 p-1 touch-none text-placeholder"
                      onTouchStart={() => setDragId(item.id)}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        const over = document.elementFromPoint(touch.clientX, touch.clientY)?.closest("[data-lib-id]");
                        const overId = over?.getAttribute("data-lib-id");
                        if (overId) dragOver(overId);
                      }}
                      onTouchEnd={dragEnd}
                    >
                      <GripVertical size={15} />
                    </span>
                    {editingId === item.id ? (
                      <form
                        ref={editFormRef}
                        action={async (fd) => {
                          await updateLibraryItem(fd);
                          setEditingId(null);
                        }}
                        // Clicking anywhere else on the screen saves —
                        // pressing Save is one way to leave the boxes,
                        // not the only one. Cancel still walks away,
                        // because it sits inside the form and so never
                        // counts as leaving it.
                        onBlur={(e) => {
                          if (editSubmittedRef.current) return;
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            editSubmittedRef.current = true;
                            e.currentTarget.requestSubmit();
                          }
                        }}
                        className="flex-1 min-w-0 space-y-1.5"
                      >
                        <input type="hidden" name="id" value={item.id} />
                        <input name="title" defaultValue={item.title} required className="w-full px-2 py-1.5 rounded-md border border-line text-sm font-semibold" />
                        <textarea name="description" rows={2} defaultValue={item.description || ""} placeholder="Description (optional)" className="w-full px-2 py-1.5 rounded-md border border-line text-xs" />
                        <div className="flex gap-2">
                          <button className="px-3 py-1 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary-700">Save</button>
                          <button type="button" onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-placeholder hover:text-primary">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-primary">{item.title}</div>
                        <div className="text-xs text-placeholder">{item.description}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {editingId !== item.id && (
                      <button onClick={() => setEditingId(item.id)} className="text-xs font-semibold text-secondary hover:underline">
                        Edit
                      </button>
                    )}
                    {/* CDC and CC ask for largely the same documents, so
                        each side offers the other a copy. */}
                    {(active === "CDC" || active === "CC") && (
                      <form action={copyLibraryItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="target" value={active === "CDC" ? "CC" : "CDC"} />
                        <SubmitButton className="text-xs font-semibold text-secondary hover:underline whitespace-nowrap">
                          Copy to {active === "CDC" ? "CC" : "CDC"}
                        </SubmitButton>
                      </form>
                    )}
                    <form action={removeLibraryItem}>
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton className="text-xs text-error hover:underline">Remove</SubmitButton>
                    </form>
                  </div>
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
                        <SubmitButton className="text-xs text-error hover:underline">Remove form</SubmitButton>
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
            {displayed.length === 0 && <div className="text-sm text-placeholder">No items yet for this checklist type.</div>}
          </div>
          <form action={addLibraryItem} className="flex gap-2">
            <input type="hidden" name="pathway" value={active} />
            <input name="title" placeholder="Document title" required className="flex-1 px-3 py-2 rounded-md border border-line text-sm" />
            <input name="description" placeholder="Description (optional)" className="flex-1 px-3 py-2 rounded-md border border-line text-sm" />
            <SubmitButton className="px-3 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 shrink-0">Add</SubmitButton>
          </form>
        </>
      )}
    </div>
  );
}
