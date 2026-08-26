"use client";

// window.print needs a client boundary; every printable page shares this
// one button rather than each carrying its own wrapper component.
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary-700">
      {label}
    </button>
  );
}
