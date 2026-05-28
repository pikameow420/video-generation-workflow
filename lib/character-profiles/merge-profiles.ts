import type { CharacterProfile } from "@/lib/schemas";

export function mergeCharacterProfileLists(
  server: CharacterProfile[],
  local: CharacterProfile[],
): CharacterProfile[] {
  const byId = new Map(server.map((profile) => [profile.id, profile]));
  for (const profile of local) {
    if (!byId.has(profile.id)) {
      byId.set(profile.id, profile);
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
