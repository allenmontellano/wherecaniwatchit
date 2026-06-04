export interface RefreshTitle {
  id: string
  tmdb_id: number
  type: string
}

// Flagged titles get refreshed first, then time-stale titles fill the rest,
// de-duplicated and capped to the per-run limit.
export function selectTitlesToRefresh(
  flagged: RefreshTitle[],
  stale: RefreshTitle[],
  cap: number
): RefreshTitle[] {
  const seen = new Set<string>()
  const out: RefreshTitle[] = []
  for (const title of [...flagged, ...stale]) {
    if (seen.has(title.id)) continue
    seen.add(title.id)
    out.push(title)
    if (out.length >= cap) break
  }
  return out
}
