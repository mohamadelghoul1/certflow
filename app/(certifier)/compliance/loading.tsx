export default function Loading() {
  return (
    <div className="animate-pulse max-w-3xl">
      <div className="h-6 w-32 bg-line rounded mb-2" />
      <div className="h-3 w-80 bg-line rounded mb-6" />
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g}>
            <div className="h-4 w-28 bg-line rounded mb-2" />
            <div className="rounded-lg border border-line bg-white overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 border-t border-line first:border-t-0" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
