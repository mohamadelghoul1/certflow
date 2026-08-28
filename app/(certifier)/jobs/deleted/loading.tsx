// Instant paint for the deleted-projects list.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-48 bg-line rounded mb-6" />
      <div className="rounded-lg overflow-hidden border border-line bg-white">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 border-t border-line first:border-t-0" />
        ))}
      </div>
    </div>
  );
}
