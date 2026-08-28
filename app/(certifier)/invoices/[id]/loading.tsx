// Instant paint for an invoice while it is fetched.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-24 bg-line rounded mb-4" />
      <div className="h-7 w-56 bg-line rounded mb-6" />
      <div className="rounded-lg border border-line bg-white p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 bg-surface rounded-md" />
        ))}
        <div className="h-10 w-40 bg-line rounded-md ml-auto" />
      </div>
    </div>
  );
}
