/** Trang khách quét mã chung của tiệm. */
export const SHARED_UPLOAD_PATH = "/gui-anh";

/** Mã gắn vào đơn, 32 ký tự hex, đủ để đặt trong đường dẫn. */
export function uploadTokenShape(token: string): boolean {
  return /^[a-f0-9]{32}$/.test(token);
}

/** Số dùng làm tên album. 84… đổi về đầu 0. */
export function albumPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const phone = digits.startsWith("84") && digits.length >= 10 ? `0${digits.slice(2)}` : digits;
  if (phone.length < 8 || phone.length > 15) throw new Error("Số điện thoại chưa đúng.");
  return phone;
}

/** Đường dẫn khách mở khi quét mã của một đơn. */
export function customerUploadPath(token: string): string {
  if (!uploadTokenShape(token)) throw new Error("Mã gửi ảnh không hợp lệ.");
  return `/gui-anh/${token}`;
}
