import type { SubtitleStyle } from "@/lib/subtitles/types";

export const INSTAGRAM_SUBTITLE_STYLE: SubtitleStyle = {
  fontName: "Avenir Next Demi Bold",
  fontSize: 13,
  outline: 0.8,
  shadow: 1,
  marginV: 46,
  alignment: 2,
};

export function ffmpegSubtitleStyle(style: SubtitleStyle): string {
  return [
    `FontName=${style.fontName}`,
    `FontSize=${style.fontSize}`,
    "OutlineColour=&H00000000",
    "BackColour=&H64000000",
    "Bold=1",
    "BorderStyle=1",

    `Outline=${style.outline}`,
    `Shadow=${style.shadow}`,
    `MarginV=${style.marginV}`,
    `Alignment=${style.alignment}`,
  ].join(",");
}
