// The same instant paint for Settings, whose sections carry their own
// fetches.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-24 bg-line rounded mb-6" />
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 lg:items-start">
        <div className="mb-5 lg:mb-0 flex gap-1 lg:flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 w-44 bg-line rounded-md" />
          ))}
        </div>
        <div className="bg-white rounded-lg border border-line max-w-3xl">
          <div className="px-5 py-4 border-b border-line">
            <div className="h-4 w-32 bg-line rounded" />
          </div>
          <div className="p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 bg-line rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
