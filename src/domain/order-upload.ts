import { remainOf } from "./money.ts";

/** Trang khách quét mã chung của tiệm. */
export const SHARED_UPLOAD_PATH = "/gui-anh";

/** Mã gắn vào đơn, 32 ký tự hex. Link cũ vẫn nhận mã này. */
export function uploadTokenShape(token: string): boolean {
  return /^[a-f0-9]{32}$/.test(token);
}

export const UPLOAD_SLUG_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Mã ngắn khách thấy, 6–8 ký tự base62. */
export function uploadSlugShape(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9A-Za-z]{6,8}$/.test(value);
}

export function uploadKeyShape(value: string): boolean {
  return uploadTokenShape(value) || uploadSlugShape(value);
}

/** 8 ký tự. Byte từ 248 trở lên bị bỏ để không lệch khi chia 62. */
export function uploadSlugFromBytes(bytes: Uint8Array): string {
  let slug = "";
  for (const byte of bytes) {
    if (byte >= 248) continue;
    slug += UPLOAD_SLUG_ALPHABET[byte % 62]!;
    if (slug.length === 8) return slug;
  }
  return slug;
}

/** Số dùng làm tên album. 84… đổi về đầu 0. */
export function albumPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const phone = digits.startsWith("84") && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
  if (phone.length < 8 || phone.length > 15) throw new Error("Số điện thoại chưa đúng.");
  return phone;
}

/** null là Drive đã nối: không chặn dung lượng. Số dương là trần khi chưa có Drive. */
export function photoTooBig(sizeBytes: number, limit: number | null): boolean {
  return limit !== null && sizeBytes > limit;
}

export function photoLimitLabel(limit: number | null): string {
  if (limit === null) return "không giới hạn dung lượng";
  return `mỗi ảnh tối đa ${Math.round(limit / (1024 * 1024))}MB`;
}

/** Đường dẫn khách mở khi quét mã của một đơn. Mã ngắn vào /u, mã hex cũ vào /gui-anh. */
export function customerUploadPath(token: string): string {
  if (uploadSlugShape(token)) return `/u/${token}`;
  if (uploadTokenShape(token)) return `/gui-anh/${token}`;
  throw new Error("Mã gửi ảnh không hợp lệ.");
}

export type PublicUploadPhoto = { id: string; name: string; createdAt: string; print: boolean; comment: string };

export type PublicUploadCard = {
  orderId: string;
  code: string;
  status: string;
  createdAt: string;
  channel: string;
  marketplaceCode: string;
  fulfillment: "pickup" | "delivery";
  address: string;
  customerNote: string;
  customerName: string;
  phone: string;
  items: { name: string; variant: string; quantity: number; lineTotal: number | null }[];
  total: number | null;
  depositPaid: number;
  remain: number | null;
  shipping: { carrier: string; tracking: string; carrierStatus: string } | null;
  photos: PublicUploadPhoto[];
};

const PHOTO_CAP = 500;

/** Thẻ khách thấy khi mở mã của đúng đơn. Không có ghi chú nội bộ, mã Drive, hay đơn khác. */
export function publicUploadCard(input: {
  order: {
    id: string;
    code: string;
    status: string;
    createdAt: string;
    channel: string;
    marketplaceCode: string;
    fulfillment: "pickup" | "delivery";
    address: string;
    customerNote: string;
    total: number | null;
    depositPaid?: number;
    shipping?: { carrier?: string; tracking?: string; carrierStatus?: string } | null;
    items: { name: string; skuCode: string; quantity: number; lineTotal: number | null }[];
    files: { id: string; name: string; status: string; kind: string; createdAt: string; deletedAt?: string | null; print?: boolean; comment?: string }[];
  };
  customer: { name: string; phone: string } | undefined;
}): PublicUploadCard {
  const photos = input.order.files
    .filter((file) => file.kind === "original" && file.status === "complete" && !file.deletedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id.localeCompare(a.id)))
    .slice(0, PHOTO_CAP)
    .map((file) => ({
      id: file.id,
      name: file.name,
      createdAt: file.createdAt,
      print: file.print === true,
      comment: (file.comment ?? "").trim(),
    }));
  const ship = input.order.shipping;
  const carrier = ship?.carrier?.trim() || "";
  const tracking = ship?.tracking?.trim() || "";
  const carrierStatus = ship?.carrierStatus?.trim() || "";
  return {
    orderId: input.order.id,
    code: input.order.code,
    status: input.order.status,
    createdAt: input.order.createdAt,
    channel: input.order.channel,
    marketplaceCode: input.order.marketplaceCode,
    fulfillment: input.order.fulfillment,
    address: input.order.address,
    customerNote: input.order.customerNote,
    customerName: input.customer?.name ?? "",
    phone: input.customer?.phone ?? "",
    items: input.order.items.map((item) => ({
      name: item.name,
      variant: item.skuCode,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    total: input.order.total,
    depositPaid: input.order.depositPaid ?? 0,
    remain: remainOf({ total: input.order.total, depositPaid: input.order.depositPaid ?? 0 }),
    shipping: carrier || tracking || carrierStatus ? { carrier, tracking, carrierStatus } : null,
    photos,
  };
}

/** Đổi cỡ ảnh nhỏ Google (`=s220`) mà không giữ đường dẫn tải đầy đủ. */
export function googleThumbSize(link: string, width: number): string | null {
  if (!link.startsWith("https://")) return null;
  if (/=s\d+/.test(link)) return link.replace(/=s\d+/, `=s${width}`);
  return `${link}=s${width}`;
}
