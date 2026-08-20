export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
        <div className="h-6 w-72 bg-slate-200 rounded mb-2" />
        <div className="h-4 w-48 bg-slate-200 rounded" />
      </div>
      <div className="flex gap-4 border-b border-slate-200 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-slate-200 rounded-t" />
        ))}
      </div>
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="h-4 w-full bg-slate-100 rounded mb-3" />
        <div className="h-4 w-5/6 bg-slate-100 rounded mb-3" />
        <div className="h-4 w-3/4 bg-slate-100 rounded" />
      </div>
    </div>
  );
}
