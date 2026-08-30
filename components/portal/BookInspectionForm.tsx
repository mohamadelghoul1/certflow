"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestedInspectionBookingDate } from "@/lib/business";
import { DateField } from "@/components/DateField";
import { notifyInspectionBooked } from "@/lib/actions/portal";

export function BookInspectionForm({ inspectionId }: { inspectionId: string }) {
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
      // Best-effort: the booking is already recorded, and a failure to
      // notify must not tell the client their booking did not take.
      notifyInspectionBooked(inspectionId).catch(() => {});
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
        <label className="block text-[11px] text-placeholder mb-1">Preferred date</label>
        <DateField
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-2 py-1.5 rounded border border-line text-xs"
        />
      </div>
      <button disabled={busy} className="text-xs font-semibold text-white bg-primary hover:bg-primary-700 px-3 py-1.5 rounded-md disabled:opacity-60">
        {busy ? "Booking…" : "Book inspection"}
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </form>
  );
}
