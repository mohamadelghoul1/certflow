export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-28 bg-line rounded mb-6" />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="h-9 flex-1 min-w-[220px] bg-line rounded-md" />
        <div className="h-9 w-48 bg-line rounded-md" />
        <div className="h-9 w-32 bg-line rounded-md ml-auto" />
      </div>
      <div className="rounded-lg overflow-hidden border border-line bg-white shadow-sm">
        <div className="h-10 bg-surface" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 border-t border-line" />
        ))}
      </div>
    </div>
  );
}
