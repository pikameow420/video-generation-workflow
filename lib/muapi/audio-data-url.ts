const DATA_AUDIO_RE =
  /^data:(audio\/(?:mpeg|wav|wave|x-wav));base64,([\s\S]+)$/i;

export type ParsedMuapiAudio = {
  buffer: Buffer;
  contentType: string;
  filename: string;
};

export function parseMuapiAudioDataUrl(
  dataUrl: string,
  index: number,
): ParsedMuapiAudio {
  const trimmed = dataUrl.trim();
  const m = DATA_AUDIO_RE.exec(trimmed);
  if (!m) {
    throw new Error(
      `Audio ${index + 1} must be data:audio/mpeg;base64,... or data:audio/wav;base64,...`,
    );
  }

  const contentTypeRaw = m[1].toLowerCase();
  const b64 = m[2].replace(/\s/g, "");
  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, "base64");
  } catch {
    throw new Error(`Audio ${index + 1}: invalid base64`);
  }

  if (!buffer.length) {
    throw new Error(`Audio ${index + 1}: file is empty`);
  }

  const ext = contentTypeRaw.includes("mpeg") ? "mp3" : "wav";
  return {
    buffer,
    contentType: contentTypeRaw.includes("mpeg") ? "audio/mpeg" : "audio/wav",
    filename: `audio-${index + 1}.${ext}`,
  };
}
