"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportBrowserError } from "@/lib/reportBrowserError";

// What a person sees when a page fails, instead of a blank screen or a
// stack trace. It reports itself on the way past, so the failure is on
// the Faults page before anyone thinks to mention it.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportBrowserError(error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white border border-line rounded-lg p-8 max-w-md w-full text-center shadow-sm">
        <div className="text-lg font-bold text-primary mb-2">This page didn&rsquo;t load</div>
        <p className="text-sm text-muted mb-1">
          Something went wrong at our end, not yours. Nothing you were working on has been lost.
        </p>
        <p className="text-sm text-muted mb-5">It has been reported automatically — you don&rsquo;t need to send it in.</p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button onClick={() => retry()} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
            Try again
          </button>
          <Link href="/" className="px-4 py-2 rounded-md border border-line text-sm text-primary font-medium hover:bg-hover">
            Back to the start
          </Link>
        </div>
        {error.digest && <div className="text-[11px] text-placeholder mt-5">Reference: {error.digest}</div>}
      </div>
    </div>
  );
}
