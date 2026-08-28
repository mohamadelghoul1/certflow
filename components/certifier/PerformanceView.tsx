import Link from "next/link";
import { Timer, Handshake } from "lucide-react";
import { formatMoney } from "@/lib/invoices/invoiceLogic";
import { formatISODate } from "@/lib/business";
import type { TurnaroundSummary, ConversionSummary } from "@/lib/performance";

// Two numbers a firm runs on. Both read straight off work already
// recorded — nothing here needs a field filled in, which is the only
// reason a measure like this is still true in March.

function Figure({ value, label, hint, tone = "" }: { value: string; label: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className={`text-3xl font-bold tracking-tight ${tone || "text-heading"}`}>{value}</div>
      <div className="text-xs font-semibold text-muted mt-1">{label}</div>
      {hint && <div className="text-[11px] text-placeholder mt-0.5">{hint}</div>}
    </div>
  );
}

export function PerformanceView({ turnaround, conversion, period }: { turnaround: TurnaroundSummary; conversion: ConversionSummary; period: string }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="flex items-center gap-2 font-bold text-primary mb-1">
          <Timer size={17} className="text-icon" /> How long a certificate takes
        </h2>
        <p className="text-xs text-muted mb-4 max-w-xl">
          From the application date recorded on the project to the day the certificate was issued, for the {turnaround.count} issued {period}. The middle
          figure rather than the average — one job that waited months on a client would drag an average somewhere that describes no real job.
        </p>

        {turnaround.count === 0 ? (
          <div className="rounded-xl border border-line bg-white p-6 text-sm text-muted text-center">No certificates were issued in this period.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Figure value={`${turnaround.median} days`} label="Typical turnaround" hint="the middle job" />
              <Figure value={`${turnaround.withinFortnight}%`} label="Issued within 14 days" tone={(turnaround.withinFortnight ?? 0) >= 80 ? "text-success" : ""} />
              <Figure value={`${turnaround.fastest} days`} label="Fastest" />
              <Figure value={`${turnaround.slowest} days`} label="Slowest" tone={(turnaround.slowest ?? 0) > 60 ? "text-warning-text" : ""} />
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-white">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-hover text-left">
                    <th className="px-3 py-2 font-semibold text-primary border-b border-line">Project</th>
                    <th className="px-3 py-2 font-semibold text-primary border-b border-line">Type</th>
                    <th className="px-3 py-2 font-semibold text-primary border-b border-line">Application</th>
                    <th className="px-3 py-2 font-semibold text-primary border-b border-line">Issued</th>
                    <th className="px-3 py-2 font-semibold text-primary border-b border-line text-right">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {turnaround.jobs.map((job) => (
                    <tr key={job.id} className="border-b border-line last:border-b-0">
                      <td className="px-3 py-2">
                        <Link href={`/jobs/${job.id}`} className="text-secondary hover:underline">
                          {job.address}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted">{job.pathway}</td>
                      <td className="px-3 py-2 text-muted">{formatISODate(job.received)}</td>
                      <td className="px-3 py-2 text-muted">{formatISODate(job.issued)}</td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${job.days > 14 ? "text-warning-text" : "text-heading"}`}>{job.days}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-placeholder mt-2">
              Where no application date has been recorded on a project, the day it was created here is used instead — so filling that field in on the
              CDC tab makes this number truer.
            </p>
          </>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 font-bold text-primary mb-1">
          <Handshake size={17} className="text-icon" /> How much quoted work is won
        </h2>
        <p className="text-xs text-muted mb-4 max-w-xl">
          Quotes raised {period}. Drafts are left out — a quote is not a quote until it has been sent — and the rate is measured against what has
          actually been decided, since a quote still sitting with a client is not a loss yet.
        </p>

        {conversion.sent === 0 ? (
          <div className="rounded-xl border border-line bg-white p-6 text-sm text-muted text-center">No quotes were sent in this period.</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Figure
              value={conversion.rate === null ? "—" : `${conversion.rate}%`}
              label="Quotes won"
              hint={conversion.rate === null ? "nothing decided yet" : `${conversion.accepted} of ${conversion.accepted + conversion.declined} decided`}
              tone={(conversion.rate ?? 0) >= 50 ? "text-success" : ""}
            />
            <Figure value={formatMoney(conversion.valueWon)} label="Value won" hint="fees, excluding GST" tone="text-success" />
            <Figure value={formatMoney(conversion.valueAwaiting)} label="Still out there" hint={`${conversion.awaiting} quote${conversion.awaiting === 1 ? "" : "s"} awaiting an answer`} />
            <Figure value={formatMoney(conversion.valueLost)} label="Value lost" hint={`${conversion.declined} declined`} />
          </div>
        )}
      </section>
    </div>
  );
}
