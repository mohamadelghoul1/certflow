"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Stamp, X } from "lucide-react";
import { setStampPlacement, clearStampPlacement } from "@/lib/actions/jobs";

// Drag the approval stamp onto the plan itself.
//
// A title block sits in a different corner on every consultant's sheet,
// so there is no one right place for the stamp. This shows page 1 of the
// document with the stamp on top of it, at the size and proportions it
// will really be printed at, and lets it be dragged and resized until it
// clears whatever is underneath.
//
// The page is drawn with pdf.js, which only loads when the panel is
// opened — it is a large library and most visits to a job never position
// a stamp.
//
// Position is kept as a fraction of the page rather than in pixels, so it
// holds whatever size the preview happens to be rendered at and whatever
// size the sheet turns out to be.

export type StampPreviewLine = { text: string; size: number; bold: boolean };

type Props = {
  itemId: string;
  jobId: string;
  fileUrl: string;
  lines: StampPreviewLine[];
  // The text half's size in PDF points at scale 1, measured server-side
  // with the same font metrics the stamp is drawn with. Everything else
  // is derived from these, so the preview and the printed stamp are the
  // same shape.
  textWidth: number;
  textHeight: number;
  stampImageUrl: string | null;
  initial: { x: number; y: number; scale: number } | null;
};

const BORDER = "#1a594f";
const INK = "#0f3330";
// Must match lib/pdf/stamp.ts.
const PADDING = 8;
const LEADING = 3;
const BORDER_WIDTH = 1.2;
const IMAGE_WIDTH = 120;
const IMAGE_GAP = 6;

export function StampPositioner({ itemId, jobId, fileUrl, lines, textWidth, textHeight, stampImageUrl, initial }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-full border border-line text-muted hover:bg-hover"
      >
        <Stamp size={13} /> {initial ? "Move stamp" : "Position stamp"}
      </button>
      {open && (
        <StampDialog
          itemId={itemId}
          jobId={jobId}
          fileUrl={fileUrl}
          lines={lines}
          textWidth={textWidth}
          textHeight={textHeight}
          stampImageUrl={stampImageUrl}
          initial={initial}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function StampDialog({ itemId, jobId, fileUrl, lines, textWidth, textHeight, stampImageUrl, initial, onClose }: Props & { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  // The rendered page's size on screen, which everything is measured against.
  const [pageSize, setPageSize] = useState<{ width: number; height: number; pdfWidth: number } | null>(null);

  const [scale, setScale] = useState(initial?.scale ?? 1);
  const [imageAspect, setImageAspect] = useState<number | null>(null);
  // Fractions of the page, top-left corner of the stamp.
  const [pos, setPos] = useState({ x: initial?.x ?? 0.7, y: initial?.y ?? 0.85 });

  // Page 1, drawn at whatever width the dialog gives it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The legacy build deliberately, not the modern one: pdf.js 6's
        // default build calls Map.prototype.getOrInsertComputed, which no
        // shipping Safari or older Chrome has yet — a certifier opening
        // this on an iPad would get nothing but an error. The legacy build
        // is the same renderer compiled for browsers that exist.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // The worker is emitted as its own asset and referenced by URL, so
        // pdf.js parses off the main thread and the dialog stays
        // responsive while a large plan is being read.
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
        const doc = await pdfjs.getDocument({ url: fileUrl }).promise;
        const page = await doc.getPage(1);
        if (cancelled) return;

        const raw = page.getViewport({ scale: 1 });
        const maxWidth = Math.min(frameRef.current?.clientWidth || 720, 900);
        const maxHeight = Math.round(window.innerHeight * 0.6);
        const fit = Math.min(maxWidth / raw.width, maxHeight / raw.height);
        const viewport = page.getViewport({ scale: fit });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.scale(dpr, dpr);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
        setPageSize({ width: viewport.width, height: viewport.height, pdfWidth: raw.width });
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("This document couldn't be previewed. It may not be a PDF, or it may be password protected.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  // PDF points to on-screen pixels, so the stamp is previewed at the size
  // it will actually be printed.
  const pxPerPoint = pageSize ? pageSize.width / pageSize.pdfWidth : 1;
  // The artwork's proportions come from the image itself once it loads —
  // the same height/width ratio the server measures off the embedded
  // image, so both work out the same block.
  const imageH = imageAspect ? IMAGE_WIDTH * imageAspect : 0;
  const gap = imageAspect ? IMAGE_GAP : 0;
  const baseWidth = Math.max(textWidth, imageAspect ? IMAGE_WIDTH : 0);
  const baseHeight = textHeight + gap + imageH;

  const unit = scale * pxPerPoint;
  const stampW = baseWidth * unit;
  const stampH = baseHeight * unit;
  const textH = textHeight * unit;

  const clampPos = useCallback(
    (x: number, y: number) => {
      if (!pageSize) return { x, y };
      const maxX = Math.max(0, 1 - stampW / pageSize.width);
      const maxY = Math.max(0, 1 - stampH / pageSize.height);
      return { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
    },
    [pageSize, stampW, stampH]
  );

  // Clamped as it is read rather than corrected after the fact, so
  // resizing near an edge can never leave the stamp hanging off the sheet
  // even for a frame.
  const view = clampPos(pos.x, pos.y);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!pageSize) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const from = { ...view };

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / pageSize.width;
      const dy = (ev.clientY - startY) / pageSize.height;
      setPos(clampPos(from.x + dx, from.y + dy));
    };
    const up = () => {
      target.releasePointerCapture(e.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function nudge(dx: number, dy: number) {
    setPos(clampPos(view.x + dx, view.y + dy));
  }

  function save() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      fd.set("x", String(view.x));
      fd.set("y", String(view.y));
      fd.set("scale", String(scale));
      await setStampPlacement(fd);
      onClose();
    });
  }

  function reset() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("item_id", itemId);
      fd.set("job_id", jobId);
      await clearStampPlacement(fd);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-3 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Position the approval stamp">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl my-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-line">
          <div>
            <div className="font-semibold text-heading">Position the approval stamp</div>
            <div className="text-xs text-muted">Drag the stamp where you want it. It goes in the same place on every page of this document.</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-hover text-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <div ref={frameRef} className="flex justify-center">
            {error ? (
              <p className="text-sm text-error py-10 text-center max-w-md">{error}</p>
            ) : (
              <div className="relative inline-block" style={{ lineHeight: 0 }}>
                <canvas ref={canvasRef} className="border border-line rounded shadow-sm" />
                {loading && <p className="text-sm text-muted py-10">Loading the plan…</p>}
                {pageSize && (
                  <div
                    onPointerDown={onPointerDown}
                    role="application"
                    aria-label="Approval stamp — drag to move"
                    className="absolute cursor-grab active:cursor-grabbing touch-none select-none"
                    style={{ left: view.x * pageSize.width, top: view.y * pageSize.height, width: stampW, height: stampH }}
                  >
                    {stampImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={stampImageUrl}
                        alt=""
                        onLoad={(e) => setImageAspect(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth)}
                        className="absolute left-0"
                        style={{ top: 0, width: IMAGE_WIDTH * unit, height: imageH * unit }}
                      />
                    )}
                    <div
                      className="absolute left-0 bg-white/95"
                      style={{
                        top: stampH - textH,
                        width: textWidth * unit,
                        height: textH,
                        border: `${Math.max(0.5, BORDER_WIDTH * unit)}px solid ${BORDER}`,
                        boxSizing: "border-box",
                      }}
                    >
                      <div style={{ padding: PADDING * unit, lineHeight: 1 }}>
                        {lines.map((l, i) => (
                          <div
                            key={i}
                            style={{
                              fontFamily: "Helvetica, Arial, sans-serif",
                              fontSize: l.size * unit,
                              fontWeight: l.bold ? 700 : 400,
                              color: INK,
                              height: (l.size + LEADING) * unit,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {l.text}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {!error && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <label className="flex items-center gap-3 text-sm text-muted">
                <span className="font-medium text-heading">Size</span>
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-44 accent-primary"
                  aria-label="Stamp size"
                />
                <span className="tabular-nums w-12">{Math.round(scale * 100)}%</span>
              </label>

              {/* Arrow buttons as well as dragging: on a phone, a fingertip
                  is wider than the gap between a title block and the sheet
                  edge, and a plan is often positioned to the millimetre. */}
              <div className="flex items-center gap-1" role="group" aria-label="Nudge the stamp">
                {([
                  ["←", -0.005, 0],
                  ["↑", 0, -0.005],
                  ["↓", 0, 0.005],
                  ["→", 0.005, 0],
                ] as const).map(([label, dx, dy]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => nudge(dx, dy)}
                    className="w-8 h-8 rounded-md border border-line text-muted hover:bg-hover"
                    aria-label={`Nudge ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-line">
          <button type="button" onClick={reset} disabled={pending} className="text-sm text-muted hover:underline disabled:opacity-60">
            Reset to bottom-right
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-sm font-medium px-4 py-2 rounded-md border border-line text-muted hover:bg-hover">
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending || !pageSize}
              className="text-sm font-semibold px-4 py-2 rounded-md bg-primary text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save position"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
