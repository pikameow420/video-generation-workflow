import type { SubtitleStyle } from "@/lib/subtitles/types";

export const INSTAGRAM_SUBTITLE_STYLE: SubtitleStyle = {
  fontName: "Arial",
  fontSize: 20,
  outline: 2,
  shadow: 0,
  marginV: 56,
  alignment: 2,
};

export function ffmpegSubtitleStyle(style: SubtitleStyle): string {
  return [
    `FontName=${style.fontName}`,
    `FontSize=${style.fontSize}`,
    "PrimaryColour=&H00FFFFFF",
    "OutlineColour=&H00000000",
    "BorderStyle=1",
    `Outline=${style.outline}`,
    `Shadow=${style.shadow}`,
    `MarginV=${style.marginV}`,
    `Alignment=${style.alignment}`,
  ].join(",");
}
