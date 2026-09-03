// The dashboard's shape, drawn before its numbers arrive.
//
// The page has to ask the database a dozen questions before it can say
// anything, and after signing in that wait lands on top of a cold
// server. A blank screen for those seconds reads as broken; the page's
// own outline, greyed, reads as loading — which it is.
export default function Loading() {
  return (
    <div className="px-2 sm:px-4 py-10 max-w-5xl mx-auto animate-pulse">
      <div className="h-8 w-44 bg-line rounded-md" />
      <div className="mt-3 h-4 w-72 bg-line rounded" />

      <div className="mt-6 rounded-xl border border-line bg-white px-5 py-4">
        <div className="h-4 w-32 bg-line rounded" />
        <div className="mt-3 h-4 w-3/4 bg-line rounded" />
        <div className="mt-2 h-4 w-2/3 bg-line rounded" />
      </div>

      <div className="mt-6 h-11 max-w-lg bg-white border border-line rounded-full" />

      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-line bg-white p-4">
            <div className="h-4 w-4 bg-line rounded" />
            <div className="mt-3 h-8 w-10 bg-line rounded" />
            <div className="mt-2 h-3 w-24 bg-line rounded" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-white">
              <div className="h-11 border-b border-line px-5 flex items-center">
                <div className="h-4 w-36 bg-line rounded" />
              </div>
              <div className="h-32" />
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <div className="rounded-xl border border-line bg-white h-72" />
          <div className="rounded-xl border border-line bg-white h-40" />
        </div>
      </div>
    </div>
  );
}
