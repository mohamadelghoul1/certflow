"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Opens the browser's print dialog on load when the page was reached with
// ?print=1 — which is how "Print / Save as PDF" on the version card works.
// Printing can only be triggered from the page being printed, so the card
// can't do it directly; it opens the document and hands over.
//
// Waits for the load event so images (the letterhead logo, the signature)
// are actually in place before the dialog snapshots the page, otherwise
// they can print blank.
export function AutoPrint() {
  const params = useSearchParams();
  const shouldPrint = params.get("print") === "1";

  useEffect(() => {
    if (!shouldPrint) return;
    if (document.readyState === "complete") {
      window.print();
      return;
    }
    const onLoad = () => window.print();
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, [shouldPrint]);

  return null;
}
