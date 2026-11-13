/**
 * Nén ảnh trên máy khách trước khi tải lên: giữ đủ nét để in (cạnh dài tối đa 4096px, JPEG 0.88).
 * Ảnh nhỏ (≤ 2.5MB, JPG/PNG/WEBP) giữ nguyên ảnh gốc. HEIC: trình duyệt đọc được (Safari) thì đổi sang JPEG,
 * không đọc được thì gửi file gốc. Ảnh nén ra lớn hơn ảnh gốc thì cũng gửi ảnh gốc.
 */
const MAX_EDGE = 4096;
const MAX_PIXELS = 16_000_000; // giới hạn canvas của Safari trên iPhone
const QUALITY = 0.88;
const KEEP_BELOW = 2.5 * 1024 * 1024;

export type PreparedPhoto = { file: File; compressed: boolean; width?: number; height?: number };

function isHeic(file: File) {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void } | null> {
  if (typeof createImageBitmap === "function" && !isHeic(file)) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // thử cách dùng <img> bên dưới
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", QUALITY));
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const plain = /^image\/(jpeg|png|webp)$/i.test(file.type);
  if (plain && file.size <= KEEP_BELOW) return { file, compressed: false };
  if (typeof document === "undefined") return { file, compressed: false };
  const img = await decode(file);
  if (!img) return { file, compressed: false };
  try {
    let scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    if (img.width * img.height * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (img.width * img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file, compressed: false };
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img.source, 0, 0, w, h);
    const blob = await toBlob(canvas);
    canvas.width = canvas.height = 0;
    if (!blob || (blob.size >= file.size && !isHeic(file))) return { file, compressed: false, width: img.width, height: img.height };
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return { file: new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified }), compressed: true, width: w, height: h };
  } catch {
    return { file, compressed: false };
  } finally {
    img.close();
  }
}
