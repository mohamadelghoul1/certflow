import Link from "next/link";

// Projects by the stage they've actually reached, as a part-to-whole ring
// with the total in the middle.
//
// The stages are derived from the job's own state rather than being a
// status someone sets by hand — a job is in assessment until its
// CDC/CC checklist is finished, ready to issue once it is, under
// construction once the certificate has been issued, and complete when
// it's marked so.
//
// Colours come from the brand's own chart assignments: accent for in
// assessment, warning for ready to issue, primary for under construction,
// success for complete. Checked with the palette validator — the two
// tests that decide whether slices can be told apart both pass with all
// pairs in play (colour-blind ΔE 16.3, normal vision 16.8, against floors
// of 8 and 15). Two slices fall under 3:1 against the card, which is why
// every one is named and counted in the legend beside the ring rather
// than identified by colour alone, and each arc carries its own tooltip.
export type Slice = { label: string; value: number; color: string; href: string };

const RADIUS = 54;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProjectsDonut({ slices }: { slices: Slice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const present = slices.filter((s) => s.value > 0);

  // A 2px gap between neighbouring arcs, so two slices never read as one
  // continuous band. Dropped when a single stage holds everything, where
  // a gap would just be a nick out of a full ring.
  const gap = present.length > 1 ? 2 : 0;

  // Each arc starts where everything before it ends, derived from the
  // slices rather than accumulated in a variable while rendering.
  const lengths = present.map((s) => (s.value / total) * CIRCUMFERENCE);
  const arcs = present.map((s, i) => ({
    ...s,
    length: lengths[i],
    offset: lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }));

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
      <svg viewBox="0 0 140 140" role="img" aria-label={`${total} projects by stage`} className="w-[132px] h-[132px] shrink-0 -rotate-90">
        <circle cx="70" cy="70" r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth={STROKE} />
        {arcs.map((s) => {
          const dash = Math.max(s.length - gap, 1);
          return (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r={RADIUS}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
              strokeDashoffset={-s.offset}
            >
              <title>{`${s.label}: ${s.value} of ${total}`}</title>
            </circle>
          );
        })}
        <g className="rotate-90 origin-center">
          <text x="70" y="66" textAnchor="middle" className="fill-heading" style={{ fontSize: 22, fontWeight: 700 }}>
            {total}
          </text>
          <text x="70" y="82" textAnchor="middle" className="fill-muted" style={{ fontSize: 9 }}>
            {total === 1 ? "Project" : "Projects"}
          </text>
        </g>
      </svg>

      <div className="w-full sm:flex-1 sm:min-w-[150px] space-y-1.5">
        {slices.map((s) => (
          <Link key={s.label} href={s.href} className="flex items-center gap-2 text-sm hover:bg-hover rounded px-1 -mx-1 py-0.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-muted flex-1 truncate">{s.label}</span>
            <span className="text-muted tabular-nums">
              {s.value}
              {total > 0 && <span className="text-placeholder"> ({Math.round((s.value / total) * 100)}%)</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
