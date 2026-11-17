/** Link/QR công khai gửi media vào Inbox Drive. */
export const MEDIA_UPLOAD_PATH = "/gui-media";

/** Giới hạn khi Drive nhận trực tiếp (ảnh + video source). */
export const MEDIA_MAX_BYTES = 1024 * 1024 * 1024;

export function mediaMimeAllowed(mime: string): boolean {
  const kind = mime.trim().toLowerCase();
  if (!kind) return false;
  if (kind.includes("javascript") || kind.includes("html") || kind === "application/x-msdownload") return false;
  return (
    kind.startsWith("image/") ||
    kind.startsWith("video/") ||
    kind === "application/octet-stream" ||
    kind === "application/zip" ||
    kind === "application/x-zip-compressed" ||
    kind === "application/x-rar-compressed" ||
    kind === "application/vnd.rar"
  );
}

export function mediaTooBig(sizeBytes: number): boolean {
  return sizeBytes < 1 || sizeBytes > MEDIA_MAX_BYTES;
}

export function formatMediaBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10_240 ? 1 : 0)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export type MediaEntry = {
  id: string;
  name: string;
  mime: string;
  size: number;
  isFolder: boolean;
  modifiedAt: string | null;
  thumbnailLink: string | null;
};

export function mediaKindLabel(entry: Pick<MediaEntry, "mime" | "isFolder">): string {
  if (entry.isFolder) return "Thư mục";
  if (entry.mime.startsWith("image/")) return "Ảnh";
  if (entry.mime.startsWith("video/")) return "Video";
  return "File";
}
