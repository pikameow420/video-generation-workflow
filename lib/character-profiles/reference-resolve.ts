import {
  buildReferenceImageMap,
  type ReferenceImageRecord,
} from "@/lib/uploads/store";
import type { CharacterProfileReference } from "@/lib/schemas";

export function referenceImagesFromMap(
  ids: string[],
  refById: Map<string, ReferenceImageRecord>,
): CharacterProfileReference[] {
  const out: CharacterProfileReference[] = [];
  for (const id of ids) {
    const item = refById.get(id);
    if (!item) continue;
    out.push({ id: item.id, url: item.url, originalName: item.originalName });
  }
  return out;
}

/** Anchor refs are stored by id; URLs are re-resolved at read time because signed URLs expire. */
export async function resolveReferenceImages(
  ids: string[],
  userId?: string,
  refById?: Map<string, ReferenceImageRecord>,
): Promise<CharacterProfileReference[]> {
  if (!ids.length) return [];
  const map = refById ?? (userId ? await buildReferenceImageMap(ids, userId) : new Map());
  return referenceImagesFromMap(ids, map);
}
