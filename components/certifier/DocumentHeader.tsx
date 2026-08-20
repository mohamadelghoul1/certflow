import type { Firm } from "@/types/db";

// Shared masthead for every generated document (certificates, inspection
// reports, and future document types) — logo + firm name/ABN on the left,
// contact details on the right, so a new document type only has to reuse
// this instead of re-styling its own header.
export function DocumentHeader({ firm, logoUrl }: { firm: Firm | null; logoUrl?: string | null }) {
  return (
    <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
      <div className="flex items-center gap-3">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={`${firm?.name || "Firm"} logo`} className="h-14 w-auto object-contain" />
        )}
        <div>
          <div className="text-lg font-black tracking-tight">{firm?.name}</div>
          <div className="text-[11px] text-slate-500">PTY LTD</div>
          <div className="text-xs text-slate-500 mt-1">ABN: {firm?.abn}</div>
        </div>
      </div>
      <div className="text-right text-xs text-slate-600 leading-relaxed">
        <div>Postal: {firm?.postal_address}</div>
        <div>Office: {firm?.office_address}</div>
        <div>(p): {firm?.phone}</div>
        <div>(e): {firm?.email}</div>
      </div>
    </div>
  );
}
