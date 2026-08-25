import { Download, Users } from "lucide-react";

// The s134 neighbour notification — one click, no setup. The letter is
// addressed "Dear Occupant" with no recipient block, following the firm's
// template, so one letter covers every letterbox: print as many copies
// as there are neighbours. Everything it merges in — the site
// address, the proposed development, the applicant's contact details —
// the job already knows. Two downloads of one letter: Word to edit
// before sending, PDF to print straight away.
export function NeighbourNotificationPanel({ jobId }: { jobId: string }) {
  return (
    <div className="border border-line rounded-xl p-6 shadow-sm bg-white">
      <div className="flex items-center gap-2 mb-1">
        <Users size={16} className="text-icon" />
        <div className="text-base font-semibold text-heading">Neighbour notification</div>
      </div>
      <p className="text-xs text-muted mb-3">
        The notice that a CDC application has been received (EP&amp;A Regulation 2021, s134), generated from this project&rsquo;s details — the site
        address, the proposed development, and the applicant&rsquo;s contact details are filled in for you. It&rsquo;s addressed &ldquo;Dear
        Occupant&rdquo;, so one letter covers every neighbour: print a copy per letterbox. Take the Word file to edit it before sending, or the PDF to print it as it is.
      </p>
      <div className="flex items-center gap-4 flex-wrap">
        <a
          href={`/api/jobs/${jobId}/neighbour-letter/word`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline"
        >
          <Download size={14} /> Export neighbour notification (Word)
        </a>
        <a
          href={`/api/jobs/${jobId}/neighbour-letter/pdf`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary hover:underline"
        >
          <Download size={14} /> Export neighbour notification (PDF)
        </a>
      </div>
    </div>
  );
}
