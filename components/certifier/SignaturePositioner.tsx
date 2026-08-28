"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { PenLine, X } from "lucide-react";
import { setSignaturePlacement } from "@/lib/actions/agreements";

// Where the signatures go on the firm's own contract.
//
// Every firm's agreement has its execution block in a different place —
// "Signature of Owner/s" in a table halfway down the last page, in this
// firm's case — so there is no position that would be right for
// everyone. This shows the contract and lets the block be dragged onto
// it, with page arrows to reach the right sheet.
//
// Held as fractions of the page rather than points, so it lands the
// same whatever size the page turns out to be. The page is drawn with
// pdf.js, loaded only when the dialog opens: it is a large library and
// most visits never place a signature.

type PdfDocument = {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(opts: { scale: number }): { width: number; height: number };
    render(opts: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void>; cancel(): void };
  }>;
  destroy?: () => Promise<void> | void;
};

type Props = {
  agreementId: string;
  jobId: string;
  fileUrl: string;
  signatories: number;
  initial: { page: number; x: number; y: number; width: number } | null;
};

export function SignaturePositioner(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-line text-sm font-semibold text-muted hover:bg-hover"
      >
        <PenLine size={14} /> {props.initial ? "Move the signature block" : "Place the signature block"}
      </button>
      {open && <Dialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({ agreementId, jobId, fileUrl, signatories, initial, onClose }: Props & { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(initial?.page ?? 1);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [pos, setPos] = useState({ x: initial?.x ?? 0.55, y: initial?.y ?? 0.6 });
  const [width, setWidth] = useState(initial?.width ?? 0.25);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Load the document once.
  useEffect(() => {
    let cancelled = false;
    let loaded: PdfDocument | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
        const task = pdfjs.getDocument({ url: fileUrl });
        loaded = (await task.promise) as unknown as PdfDocument;
        if (cancelled) return;
        setDoc(loaded);
        setPageCount(loaded.numPages);
        // Most execution blocks are on the last page.
        if (!initial) setPage(loaded.numPages);
      } catch {
        if (!cancelled) setError("The contract could not be opened for preview. You can still send it — the signatures will be added on a page at the end.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.destroy?.();
    };
  }, [fileUrl, initial]);

  // Draw whichever page is showing.
  useEffect(() => {
    if (!doc) return;
    let task: { cancel(): void } | null = null;
    (async () => {
      const canvas = canvasRef.current;
      const frame = frameRef.current;
      if (!canvas || !frame) return;
      const target = await doc.getPage(Math.min(page, doc.numPages));
      const base = target.getViewport({ scale: 1 });
      const scale = Math.min(frame.clientWidth / base.width, (window.innerHeight * 0.62) / base.height);
      const viewport = target.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setSize({ width: viewport.width, height: viewport.height });
      const context = canvas.getContext("2d");
      if (!context) return;
      task = target.render({ canvas, canvasContext: context, viewport });
      await (task as unknown as { promise: Promise<void> }).promise.catch(() => {});
    })();
    return () => task?.cancel();
  }, [doc, page]);

  function place(e: React.PointerEvent<HTMLDivElement>) {
    const frame = e.currentTarget.getBoundingClientRect();
    setPos({
      x: Math.min(0.95, Math.max(0, (e.clientX - frame.left) / frame.width)),
      y: Math.min(0.98, Math.max(0.02, (e.clientY - frame.top) / frame.height)),
    });
  }

  function save() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("agreement_id", agreementId);
      fd.set("job_id", jobId);
      fd.set("page", String(page));
      fd.set("x", String(pos.x));
      fd.set("y", String(pos.y));
      fd.set("width", String(width));
      await setSignaturePlacement(fd);
      onClose();
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-heading/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-full overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-bold text-primary">Place the signature block</div>
            <div className="text-xs text-muted mt-0.5">
              Click where the signatures should sit on your contract — usually the &ldquo;Signature of Owner/s&rdquo; box.
              {signatories > 1 ? ` All ${signatories} signatures stack downwards from there.` : ""}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-heading">
            <X size={18} />
          </button>
        </div>

        {error && <div className="text-sm text-warning-text bg-warning-bg border border-warning/50 rounded-md px-3 py-2 mb-3">{error}</div>}
        {loading && <div className="text-sm text-muted py-10 text-center">Opening the contract…</div>}

        <div ref={frameRef} className="relative mx-auto" style={{ width: size?.width, height: size?.height }}>
          <canvas ref={canvasRef} className="block border border-line" />
          {size && (
            <div
              className="absolute inset-0 cursor-crosshair"
              onPointerDown={(e) => {
                setDragging(true);
                place(e);
              }}
              onPointerMove={(e) => dragging && place(e)}
              onPointerUp={() => setDragging(false)}
              onPointerLeave={() => setDragging(false)}
            >
              <div
                className="absolute border-2 border-dashed border-icon bg-info-bg/70 rounded flex items-center justify-center text-[10px] font-semibold text-secondary pointer-events-none"
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  width: `${width * 100}%`,
                  height: `${Math.max(6, width * 32)}%`,
                }}
              >
                Signatures
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-4">
          {pageCount > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-1 border border-line rounded hover:bg-hover">
                ←
              </button>
              <span className="text-muted">
                Page {page} of {pageCount}
              </span>
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="px-2 py-1 border border-line rounded hover:bg-hover">
                →
              </button>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-muted">
            Width
            <input type="range" min={0.12} max={0.5} step={0.01} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
          </label>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted hover:bg-hover rounded-md">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={pending} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60">
              {pending ? "Saving…" : "Save position"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
