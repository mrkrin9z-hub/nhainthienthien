const IMAGE_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

export function cleanMime(mime: string): string {
  return mime.toLowerCase().split(";")[0]?.trim() ?? "";
}

export function imageMimeAllowed(mime: string): boolean {
  return IMAGE_MIME.includes(cleanMime(mime));
}

const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

/** Ảnh thì có khung xem trước. Video và file khác giữ tên để tải. */
export function imagePreviewable(name: string, mime = ""): boolean {
  if (imageMimeAllowed(mime)) return true;
  const lower = name.toLowerCase();
  return IMAGE_EXT.some((ext) => lower.endsWith(ext));
}

function starts(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((value, index) => bytes[index] === value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (bytes.length < start + length) return "";
  return String.fromCharCode(...bytes.slice(start, start + length));
}

/** true khi vài byte đầu khớp loại đã khai. HEIC nhận nhãn ftyp phổ biến. */
export function imageBytesMatch(mime: string, bytes: Uint8Array): boolean {
  const kind = cleanMime(mime);
  if (kind === "image/jpeg" || kind === "image/jpg") return starts(bytes, [0xff, 0xd8, 0xff]);
  if (kind === "image/png") return starts(bytes, [0x89, 0x50, 0x4e, 0x47]);
  if (kind === "image/webp") return starts(bytes, [0x52, 0x49, 0x46, 0x46]) && ascii(bytes, 8, 4) === "WEBP";
  if (kind === "image/heic" || kind === "image/heif") {
    if (ascii(bytes, 4, 4) !== "ftyp") return false;
    return ["heic", "heix", "hevc", "heif", "mif1", "msf1", "heim", "heis"].includes(ascii(bytes, 8, 4));
  }
  return false;
}

/** Kiểu trình duyệt được phép trả. Không trả HTML hay SVG. */
export function servedMime(mime: string): string {
  const kind = cleanMime(mime);
  if (imageMimeAllowed(kind)) return kind === "image/jpg" ? "image/jpeg" : kind;
  if (kind === "video/mp4" || kind === "video/webm" || kind === "video/quicktime") return kind;
  return "application/octet-stream";
}

/** Tên file an toàn trong Content-Disposition: bỏ ngoặc kép và xuống dòng. */
export function contentDisposition(name: string, download = false): string {
  const cleaned = name.replace(/[\r\n"\\]/g, "").slice(-120) || "tep";
  const asciiName = cleaned.replace(/[^\x20-\x7E]/g, "_");
  const kind = download ? "attachment" : "inline";
  return `${kind}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(cleaned)}`;
}
