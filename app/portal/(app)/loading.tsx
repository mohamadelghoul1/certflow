// Instant paint for the client's project list.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 bg-line rounded mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-white border border-line rounded-lg" />
        ))}
      </div>
    </div>
  );
}
