"use client";

import { useActionState, useRef, useState } from "react";
import { signAgreement, type SignState } from "@/lib/actions/agreements";
import { PenLine, Type, Eraser, CheckCircle2 } from "lucide-react";

// Signing means making a mark, not ticking a box.
//
// Two ways to make one, because a phone and a desktop suit different
// things: draw it with a finger, or type the name and have it written
// out. Either way an image of the signature is produced, and it is that
// image which is drawn into the contract — so what the owner does here
// is what appears on the executed document.
export function SignAgreementForm({ token, name }: { token: string; name: string }) {
  const [state, formAction, pending] = useActionState<SignState, FormData>(signAgreement, undefined);
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [hasMark, setHasMark] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  function ctx() {
    return canvasRef.current?.getContext("2d") || null;
  }

  function clear() {
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    setHasMark(false);
    if (imageRef.current) imageRef.current.value = "";
  }

  function capture() {
    if (imageRef.current && canvasRef.current) imageRef.current.value = canvasRef.current.toDataURL("image/png");
  }

  // Typing writes the name across the canvas in a hand style, so the
  // same picture-of-a-signature reaches the contract either way. Drawn
  // from the handlers that change it rather than from an effect: the
  // canvas is downstream of what was typed, not a thing to synchronise.
  function renderTyped(text: string) {
    const canvas = canvasRef.current;
    const c = ctx();
    if (!canvas || !c) return;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const trimmed = text.trim();
    if (!trimmed) {
      setHasMark(false);
      if (imageRef.current) imageRef.current.value = "";
      return;
    }
    c.fillStyle = "#0f172a";
    let size = 54;
    do {
      c.font = `italic ${size}px "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive`;
      size -= 2;
    } while (c.measureText(trimmed).width > canvas.width - 40 && size > 18);
    c.fillText(trimmed, 20, canvas.height / 2 + size / 3);
    setHasMark(true);
    capture();
  }

  function changeName(value: string) {
    setTypedName(value);
    if (mode === "type") renderTyped(value);
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    // The canvas is drawn at a fixed size but displayed responsively.
    return {
      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== "draw") return;
    const c = ctx();
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = pos(e);
    c.beginPath();
    c.moveTo(x, y);
    setDrawing(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || mode !== "draw") return;
    const c = ctx();
    if (!c) return;
    const { x, y } = pos(e);
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "#0f172a";
    c.lineTo(x, y);
    c.stroke();
    setHasMark(true);
  }

  function stop() {
    if (!drawing) return;
    setDrawing(false);
    if (hasMark) capture();
  }

  // The moment the signature is recorded, the form is replaced by the
  // confirmation. A signatory who pressed Sign and saw the same form
  // again has no way of knowing anything happened — and a browser
  // cannot close a tab it did not open, so saying so plainly is the
  // honest version of "the page closes".
  if (state?.signed) {
    return (
      <div className="rounded-md bg-success-bg border border-accent/40 px-5 py-6 text-center">
        <CheckCircle2 size={32} className="mx-auto text-accent" />
        <div className="font-bold text-accent text-lg mt-3">Thank you — your signature has been recorded</div>
        <p className="text-sm text-muted mt-2">
          A copy of the signed agreement will be held with your project, and your certifier has been notified. You can close this page.
        </p>
      </div>
    );
  }

  const tab = (active: boolean) =>
    `flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-md border ${
      active ? "bg-primary text-white border-primary" : "bg-white text-muted border-line hover:border-primary"
    }`;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="signature_image" ref={imageRef} />

      <div>
        <label className="block text-xs font-semibold text-placeholder mb-1">Your full name</label>
        <input
          name="signed_name"
          required
          value={typedName}
          onChange={(e) => changeName(e.target.value)}
          placeholder={name}
          autoComplete="name"
          className="w-full px-3 py-2.5 rounded-md border border-line text-base outline-none focus:ring-2 focus:ring-icon"
        />
      </div>

      <div>
        <div className="block text-xs font-semibold text-placeholder mb-1.5">Your signature</div>
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => { setMode("draw"); clear(); }} className={tab(mode === "draw")}>
            <PenLine size={14} /> Draw it
          </button>
          <button type="button" onClick={() => { setMode("type"); renderTyped(typedName); }} className={tab(mode === "type")}>
            <Type size={14} /> Write it for me
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={560}
          height={150}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerLeave={stop}
          className={`w-full h-36 border-2 border-dashed rounded-md bg-white touch-none ${
            hasMark ? "border-accent/50" : "border-line"
          } ${mode === "draw" ? "cursor-crosshair" : ""}`}
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-muted">
            {mode === "draw" ? "Sign above using your finger or mouse." : "Type your name above and it will be written here."}
          </span>
          {mode === "draw" && (
            <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs text-muted hover:underline">
              <Eraser size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-muted">
        <input type="checkbox" name="declaration" className="mt-1 accent-icon" />
        <span>
          I have read the agreement, I am authorised to sign it, and I agree to be bound by its terms. I accept that my signature above has the same
          effect as signing by hand.
        </span>
      </label>

      {state?.error && <div className="text-sm text-error bg-error-bg border border-error/40 rounded-md px-3 py-2">{state.error}</div>}

      <button disabled={pending} className="w-full py-3 rounded-md bg-primary text-white font-semibold hover:bg-primary-700 disabled:opacity-60">
        {pending ? "Signing…" : "Sign the agreement"}
      </button>
    </form>
  );
}
