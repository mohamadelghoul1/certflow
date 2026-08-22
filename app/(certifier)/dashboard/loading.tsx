export default function Loading() {
  return (
    <div className="px-2 py-10 animate-pulse">
      <div className="flex flex-col items-center">
        <div className="w-full max-w-lg h-10 bg-line rounded-md" />
        <div className="w-full max-w-lg mt-10">
          <div className="h-3 w-32 bg-line rounded mb-2" />
          <div className="rounded-lg overflow-hidden border border-line bg-white">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 border-t border-line first:border-t-0" />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-12">
        <div className="h-3 w-16 bg-line rounded mb-3" />
        <div className="flex gap-2 mb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-24 bg-line rounded-full" />
          ))}
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-64 h-48 bg-white border border-line rounded-lg shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
}
