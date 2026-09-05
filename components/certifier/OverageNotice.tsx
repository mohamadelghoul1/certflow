import Link from "next/link";
import { Info, TriangleAlert } from "lucide-react";
import type { OverageNotice as Notice } from "@/lib/billing";

// What the firm is about to be charged, said before they press the
// button rather than on the invoice.
export function OverageNoticeCard({ notice }: { notice: Notice | null }) {
  if (!notice) return null;
  const strong = notice.level !== "near";
  const Icon = strong ? TriangleAlert : Info;

  return (
    <div
      className={`mb-5 flex items-start gap-3 rounded-lg border px-4 py-3 ${
        strong ? "border-warning/50 bg-warning-bg text-warning-text" : "border-line bg-surface text-muted"
      }`}
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 text-sm">
        <div className={`font-semibold ${strong ? "" : "text-heading"}`}>{notice.headline}</div>
        <p className="mt-0.5 text-xs leading-relaxed">{notice.detail}</p>
        <Link href="/settings?section=plan" className="mt-1.5 inline-block text-xs font-semibold hover:underline">
          See your plan →
        </Link>
      </div>
    </div>
  );
}
