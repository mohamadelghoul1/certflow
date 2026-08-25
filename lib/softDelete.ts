// Deleted jobs are still in the table. Every list, count and lookup has
// to leave them out, and this is the one place that knows how.
//
// The wrinkle is deployment order: the app goes live the moment it is
// pushed, but the migration that adds `deleted_at` is run by hand
// afterwards. In between, asking for a column the database has never
// heard of would break the jobs list outright. So the filtered query is
// tried first and, only if the database says it does not know the
// column, the same query is run again without it. Once the migration is
// in, that second attempt never happens.

type Answer<T> = { data: T; error: { code?: string } | null };

export function isUnknownColumn(error: { code?: string } | null | undefined): boolean {
  if (!error) return false;
  // 42703 is Postgres itself; the PGRST codes are PostgREST rejecting the
  // column before it gets that far.
  return error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST100";
}

export async function excludingDeleted<T>(run: (live: boolean) => PromiseLike<Answer<T>>): Promise<Answer<T>> {
  const filtered = await run(true);
  if (isUnknownColumn(filtered.error)) return run(false);
  return filtered;
}
