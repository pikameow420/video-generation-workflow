/** Stable key for deduping saved scripts by title + body. */
export function savedScriptDedupeKey(title: string, body: string): string {
  return `${title.trim()}::${body.trim()}`;
}

/** Keep first occurrence per title+body (newest-first lists). */
export function dedupeByTitleBody<T extends { title: string; body: string }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = savedScriptDedupeKey(item.title, item.body);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
