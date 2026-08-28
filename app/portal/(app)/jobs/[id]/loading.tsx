// Instant paint for a client's project: the heading, the stage tabs and
// the first cards appear at once, so opening a project never looks like
// a page that failed to respond.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-3 w-24 bg-line rounded mb-2" />
        <div className="h-6 w-72 bg-line rounded mb-2" />
        <div className="h-3 w-48 bg-line rounded" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-44 bg-line rounded-md" />
        ))}
      </div>
      <div className="bg-white rounded-lg border border-line">
        <div className="h-12 border-b border-line" />
        <div className="p-5 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 border border-line rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
