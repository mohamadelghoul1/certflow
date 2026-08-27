// Painted the instant Audit is pressed, while the records are fetched —
// the menu is real-looking so the page feels arrived, not pending.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-24 bg-line rounded mb-6" />
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 lg:items-start">
        <div className="mb-5 lg:mb-0 flex gap-1 lg:flex-col">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 w-40 bg-line rounded-md" />
          ))}
        </div>
        <div>
          <div className="h-4 w-48 bg-line rounded mb-4" />
          <div className="space-y-4 max-w-3xl">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-white border border-line rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
