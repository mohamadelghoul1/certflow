import type { Firm } from "@/types/db";

// Shared masthead for every generated document (certificates, inspection
// reports, and future document types) — logo + ABN on the left, contact
// details on the right. A real <table> rather than flex: this ends up in
// Word exports too, and Word has no flexbox support at all — a table is
// the only way the two sides land side-by-side there instead of stacking.
//
// Matches the firm's real letterhead: the uploaded logo already has the
// full wordmark ("Quality Private Certifiers Pty Ltd") baked into the
// image, so the firm name is only rendered as text when no logo has been
// uploaded yet — otherwise it would show twice.
export function DocumentHeader({ firm, logoUrl }: { firm: Firm | null; logoUrl?: string | null }) {
  return (
    <table className="w-full border-b-2 border-slate-800 mb-6">
      <tbody>
        <tr>
          <td className="align-top pb-4 w-1/2">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={`${firm?.name || "Firm"} logo`} className="h-16 w-auto object-contain" />
            ) : (
              <div>
                <div className="text-lg font-black tracking-tight">{firm?.name}</div>
                <div className="text-[11px] text-slate-500">PTY LTD</div>
              </div>
            )}
            <div className="text-xs text-slate-500 mt-1">ABN: {firm?.abn}</div>
          </td>
          <td className="align-top pb-4 text-right text-xs text-slate-600 leading-relaxed w-1/2">
            <div>Postal: {firm?.postal_address}</div>
            <div>Office: {firm?.office_address}</div>
            <div>(p): {firm?.phone}</div>
            <div>(e): {firm?.email}</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
