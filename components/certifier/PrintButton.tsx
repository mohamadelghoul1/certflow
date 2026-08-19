"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-md bg-teal-800 text-white text-sm font-semibold hover:bg-teal-900 print:hidden"
    >
      Print / Save as PDF
    </button>
  );
}
