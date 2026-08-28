// Instant paint for the New project form while the lists it offers load.
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-7 w-52 bg-line rounded mb-6" />
      <div className="rounded-lg border border-line bg-white p-6 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface rounded-md" />
        ))}
      </div>
    </div>
  );
}
