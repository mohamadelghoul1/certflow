export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-20 bg-line rounded mb-2" />
        <div className="h-6 w-72 bg-line rounded mb-2" />
        <div className="h-4 w-48 bg-line rounded" />
      </div>
      <div className="flex gap-4 border-b border-line mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-line rounded-t" />
        ))}
      </div>
      <div className="bg-white rounded-lg border border-line p-5">
        <div className="h-4 w-full bg-surface rounded mb-3" />
        <div className="h-4 w-5/6 bg-surface rounded mb-3" />
        <div className="h-4 w-3/4 bg-surface rounded" />
      </div>
    </div>
  );
}
