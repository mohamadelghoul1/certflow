// Instant paint for a quote while it is fetched.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 w-24 bg-line rounded mb-4" />
      <div className="h-7 w-72 bg-line rounded mb-6" />
      <div className="rounded-lg border border-line bg-white p-6 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface rounded-md" />
        ))}
      </div>
    </div>
  );
}
