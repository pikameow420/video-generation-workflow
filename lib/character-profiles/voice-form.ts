import {
  allowedCharacterVoiceMimeTypes,
  maxCharacterVoiceBytes,
} from "@/lib/schemas";

export type ParsedVoiceSample = {
  bytes: Uint8Array;
  mimeType: string;
  originalName: string;
};

/**
 * Reads the optional `voiceSample` file from a profile create/update form.
 * Returns `{ error }` with a user-facing message when the file is invalid.
 */
export async function readVoiceSampleFromForm(
  form: FormData,
): Promise<
  | { voiceSample: ParsedVoiceSample | null; error?: never }
  | { voiceSample?: never; error: string }
> {
  const entry = form.get("voiceSample");
  if (entry === null) {
    return { voiceSample: null };
  }
  if (!(entry instanceof File)) {
    return { error: "voiceSample must be a file" };
  }
  const mime = entry.type.toLowerCase();
  if (
    !allowedCharacterVoiceMimeTypes.includes(
      mime as (typeof allowedCharacterVoiceMimeTypes)[number],
    )
  ) {
    return { error: "Unsupported voice sample type. Allowed: MP3 or WAV" };
  }
  if (entry.size > maxCharacterVoiceBytes) {
    return {
      error: `Voice sample is too large. Max size is ${Math.round(
        maxCharacterVoiceBytes / (1024 * 1024),
      )}MB`,
    };
  }
  return {
    voiceSample: {
      bytes: new Uint8Array(await entry.arrayBuffer()),
      mimeType: mime,
      originalName: entry.name || "voice-sample",
    },
  };
}
