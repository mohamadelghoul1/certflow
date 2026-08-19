"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestedInspectionBookingDate } from "@/lib/business";

export function BookInspectionForm({ inspectionId, jobId }: { inspectionId: string; jobId: string }) {
  const [date, setDate] = useState(() => suggestedInspectionBookingDate(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("client_book_inspection", { p_inspection_id: inspectionId, p_date: date });
      if (rpcError) throw rpcError;
      fetch("/api/notify/inspection-booked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId, jobId, date }),
      }).catch(() => {});
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't book that date.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div>
        <label className="block text-[11px] text-slate-400 mb-1">Preferred date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1.5 rounded border border-slate-200 text-xs"
        />
      </div>
      <button disabled={busy} className="text-xs font-semibold text-white bg-teal-800 hover:bg-teal-900 px-3 py-1.5 rounded-md disabled:opacity-60">
        {busy ? "Booking…" : "Book inspection"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
