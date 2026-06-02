import type { RunCharacterSelection } from "@/components/pipeline/types";
import type { CharacterProfile } from "@/lib/schemas";

export type RunReadinessResult = { ok: true } | { ok: false; reason: string };

export function assertRunProfilesSelected(
  runCharacters: RunCharacterSelection[],
): RunReadinessResult {
  if (!runCharacters.length) {
    return { ok: false, reason: "Select at least one character profile for this run." };
  }
  if (runCharacters.length > 3) {
    return {
      ok: false,
      reason: "At most 3 characters per run.",
    };
  }
  return { ok: true };
}

export function assertRunReadyForFrameSheet(
  runCharacters: RunCharacterSelection[],
  profiles: CharacterProfile[],
): RunReadinessResult {
  const selected = assertRunProfilesSelected(runCharacters);
  if (!selected.ok) return selected;

  for (const run of runCharacters) {
    const profile = profiles.find((p) => p.id === run.profileId);
    if (!profile) {
      return { ok: false, reason: "A selected character profile could not be found." };
    }
    if (!profile.characterSheetUrl) {
      return {
        ok: false,
        reason: `"${profile.name}" needs a character sheet. Generate it in the profile editor.`,
      };
    }
  }
  return { ok: true };
}

export function assertRunReadyForMuapiVideo(
  runCharacters: RunCharacterSelection[],
  profiles: CharacterProfile[],
): RunReadinessResult {
  const sheetReady = assertRunReadyForFrameSheet(runCharacters, profiles);
  if (!sheetReady.ok) return sheetReady;

  for (const run of runCharacters) {
    const profile = profiles.find((p) => p.id === run.profileId);
    if (!profile?.voiceSample) {
      return {
        ok: false,
        reason: `"${profile?.name ?? "Character"}" needs a voice sample for video.`,
      };
    }
  }
  return { ok: true };
}
