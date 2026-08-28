// Instant paint for the checklist document while it is assembled.
export default function Loading() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto p-8 mt-16 bg-white animate-pulse">
        <div className="h-6 w-64 bg-line rounded mb-2" />
        <div className="h-3 w-40 bg-line rounded mb-8" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 border-b border-line" />
        ))}
      </div>
    </div>
  );
}
