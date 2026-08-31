"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { suggestedInspectionBookingDate, formatISODate } from "@/lib/business";
import { DateField } from "@/components/DateField";
import { notifyInspectionBooked } from "@/lib/actions/portal";

// Asking for a date, not taking one.
//
// The client picks a day and the certifier answers it — so the button
// says request, and the moment it is pressed the form is replaced by the
// answer they are waiting on rather than staying pressable. The page
// refreshes behind that into the same message from the server.
export function BookInspectionForm({ inspectionId }: { inspectionId: string }) {
  const [date, setDate] = useState(() => suggestedInspectionBookingDate(""));
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState("");
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
      // Locked the instant it is sent: asking twice would overwrite the
      // date the office is in the middle of answering.
      setRequested(date);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that request.");
    } finally {
      setBusy(false);
    }
  }

  if (requested) {
    return (
      <div className="text-xs text-warning-text bg-warning-bg rounded-md px-3 py-2">
        You asked for <strong>{formatISODate(requested)}</strong>. This inspection will be booked once our office accepts the date — we will confirm
        it, or offer another day, and this page will update.
      </div>
    );
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
        {busy ? "Sending…" : "Request inspection"}
      </button>
      {error && <span className="text-xs text-error">{error}</span>}
    </form>
  );
}
