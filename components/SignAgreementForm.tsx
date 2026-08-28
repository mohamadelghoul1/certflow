"use client";

import { useActionState, useRef, useState } from "react";
import { signAgreement, type SignState } from "@/lib/actions/agreements";
import { PenLine, Eraser } from "lucide-react";

// What a signatory actually does: read the agreement, type their name,
// tick the declaration, and — if they want it to look traditional —
// draw a signature. The typed name and the declaration are the record;
// the drawing is decoration on top of it.
export function SignAgreementForm({ token, name }: { token: string; name: string }) {
  const [state, formAction, pending] = useActionState<SignState, FormData>(signAgreement, undefined);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }

  function stop() {
    setDrawing(false);
    // Carried in a hidden field so the drawing travels with the form.
    if (imageRef.current && canvasRef.current && hasInk) imageRef.current.value = canvasRef.current.toDataURL("image/png");
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    if (imageRef.current) imageRef.current.value = "";
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="signature_image" ref={imageRef} />

      <div>
        <label className="block text-xs font-semibold text-placeholder mb-1">Type your full name to sign</label>
        <input
          name="signed_name"
          required
          defaultValue=""
          placeholder={name}
          autoComplete="name"
          className="w-full px-3 py-2.5 rounded-md border border-line text-base outline-none focus:ring-2 focus:ring-icon"
        />
      </div>

      <details className="rounded-md border border-line">
        <summary className="px-3 py-2 text-sm text-secondary cursor-pointer hover:underline flex items-center gap-2">
          <PenLine size={14} /> Draw your signature (optional)
        </summary>
        <div className="p-3 border-t border-line">
          <canvas
            ref={canvasRef}
            width={520}
            height={140}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerLeave={stop}
            className="w-full max-w-lg h-32 border border-dashed border-line rounded-md bg-white touch-none cursor-crosshair"
          />
          <button type="button" onClick={clear} className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted hover:underline">
            <Eraser size={12} /> Clear
          </button>
        </div>
      </details>

      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input type="checkbox" name="declaration" className="mt-1 accent-icon" />
        <span>
          I have read the agreement, I am authorised to sign it, and I agree to be bound by its terms. I accept that signing electronically has the same
          effect as signing by hand.
        </span>
      </label>

      {state?.error && <div className="text-sm text-error bg-error-bg border border-error/40 rounded-md px-3 py-2">{state.error}</div>}

      <button
        disabled={pending}
        className="w-full py-3 rounded-md bg-primary text-white font-semibold hover:bg-primary-700 disabled:opacity-60"
      >
        {pending ? "Signing…" : "Sign the agreement"}
      </button>
    </form>
  );
}
