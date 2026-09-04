import { FlaskConical } from "lucide-react";

// The bar across the top of a demonstration account.
//
// It is there for two people at once: the certifier being shown
// Certlyn, who should never be in any doubt that the projects on screen
// are made up; and whoever is driving, who needs to know that pressing
// Send is safe. Both facts are said plainly, on every page.
export function DemoBanner({ firmName }: { firmName?: string }) {
  return (
    <div className="bg-[#f0b93a] text-[#241b06] px-4 sm:px-6 py-2 text-[12px] font-medium flex items-center justify-center gap-2 text-center">
      <FlaskConical size={14} className="shrink-0" />
      <span>
        <span className="font-bold">Demonstration account{firmName ? ` — ${firmName}` : ""}.</span> Every project, client and document here is made up,
        and no email is ever sent from this account.
      </span>
    </div>
  );
}
