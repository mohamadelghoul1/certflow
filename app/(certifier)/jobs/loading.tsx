export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-6 w-28 bg-slate-200 rounded mb-6" />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="h-9 flex-1 min-w-[220px] bg-slate-200 rounded-md" />
        <div className="h-9 w-48 bg-slate-200 rounded-md" />
        <div className="h-9 w-32 bg-slate-200 rounded-md ml-auto" />
      </div>
      <div className="rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="h-10 bg-slate-100" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 border-t border-slate-100" />
        ))}
      </div>
    </div>
  );
}
