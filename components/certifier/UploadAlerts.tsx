"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";

type Alert = { id: number; address: string | null; fileName: string | null; itemTitle: string | null };

// A gentle live alert while CertFlow is open: every half minute the app
// asks whether a client has uploaded anything since it last looked, and
// a new document gets a corner toast and a two-note chime. The email
// still goes out regardless — this is for the certifier already at
// their desk with the site open.
//
// The chime is drawn with the browser's own audio rather than a sound
// file, and browsers only allow sound after the person has interacted
// with the page at least once — before that the toast appears silently.
export function UploadAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const sinceRef = useRef<string>(new Date().toISOString());
  const audioRef = useRef<AudioContext | null>(null);
  const nextId = useRef(1);

  useEffect(() => {
    // An AudioContext created during a user gesture starts unlocked;
    // grab one on the first interaction so a later chime can sound.
    const unlock = () => {
      if (!audioRef.current) {
        try {
          audioRef.current = new AudioContext();
        } catch {
          // No audio available — toasts alone, then.
        }
      }
      void audioRef.current?.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    let stopped = false;

    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/uploads/recent?since=${encodeURIComponent(sinceRef.current)}`);
        if (!res.ok) return;
        const body = (await res.json()) as { uploads: { address: string | null; fileName: string | null; itemTitle: string | null; uploadedAt: string }[]; now: string };
        if (stopped) return;
        sinceRef.current = body.now;
        if (body.uploads.length === 0) return;

        const fresh = body.uploads.map((u) => ({ id: nextId.current++, address: u.address, fileName: u.fileName, itemTitle: u.itemTitle }));
        setAlerts((prev) => [...prev, ...fresh].slice(-4));
        chime();
        for (const alert of fresh) {
          setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id)), 12000);
        }
      } catch {
        // Offline or mid-deploy — try again next round.
      }
    }

    function chime() {
      const ctx = audioRef.current;
      if (!ctx || ctx.state !== "running") return;
      // Two rising notes, short and soft — a doorbell, not an alarm.
      const note = (freq: number, at: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + at);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.55);
      };
      note(660, 0);
      note(880, 0.18);
    }

    const interval = setInterval(poll, 30_000);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 space-y-2 max-w-xs">
      {alerts.map((a) => (
        <div key={a.id} className="bg-heading text-white rounded-lg shadow-xl px-4 py-3 flex items-start gap-3">
          <UploadCloud size={18} className="text-warning shrink-0 mt-0.5" />
          <div className="text-sm min-w-0">
            <div className="font-semibold">Document uploaded</div>
            <div className="text-white/80 text-xs mt-0.5 break-words">
              {a.fileName || "A document"}
              {a.itemTitle ? ` — ${a.itemTitle}` : ""}
              {a.address ? ` · ${a.address}` : ""}
            </div>
          </div>
          <button type="button" onClick={() => setAlerts((prev) => prev.filter((x) => x.id !== a.id))} className="text-white/60 hover:text-white shrink-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
