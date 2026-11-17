/** Hub Media — Drive source + tạo feedback giả. */

export const MEDIA_MODES = ["drive", "feedback"] as const;
export type MediaMode = (typeof MEDIA_MODES)[number];

export function parseMediaMode(value: unknown): MediaMode | "" {
  return MEDIA_MODES.includes(value as MediaMode) ? (value as MediaMode) : "";
}
