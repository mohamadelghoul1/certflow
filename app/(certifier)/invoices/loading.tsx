// Instant paint for the invoices list while the totals are fetched.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-24 bg-line rounded mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-white border border-line rounded-xl" />
        ))}
      </div>
      <div className="rounded-lg overflow-hidden border border-line bg-white">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 border-t border-line first:border-t-0" />
        ))}
      </div>
    </div>
  );
}
