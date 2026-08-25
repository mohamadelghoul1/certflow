// Shown the instant a project is opened, while its data is fetched.
//
// Without it the browser sits on the jobs list with nothing happening
// until the whole page is ready, which reads as the click not having
// registered — so the click gets repeated. This is the same shape the
// real page takes, so the content arrives into a layout that is already
// there rather than shifting everything on arrival.
function Bar({ className }: { className: string }) {
  return <div className={`bg-line rounded animate-pulse ${className}`} />;
}

export default function Loading() {
  return (
    <div>
      <div className="mb-8">
        <Bar className="h-3 w-24 mb-3" />
        <Bar className="h-8 w-96 max-w-full mb-2" />
        <Bar className="h-4 w-64 max-w-full" />
      </div>

      <div className="mb-8 inline-flex gap-1 bg-surface rounded-full p-1">
        {["w-20", "w-24", "w-20", "w-28", "w-36"].map((w) => (
          <Bar key={w} className={`h-9 rounded-full ${w}`} />
        ))}
      </div>

      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border border-line rounded-xl p-6 bg-white">
            <Bar className="h-4 w-52 mb-3" />
            <Bar className="h-3 w-full max-w-xl mb-2" />
            <Bar className="h-3 w-2/3 max-w-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
