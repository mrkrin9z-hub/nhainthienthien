/** Mã gắn vào đơn, 32 ký tự hex, đủ để đặt trong đường dẫn. */
export function uploadTokenShape(token: string): boolean {
  return /^[a-f0-9]{32}$/.test(token);
}

/** Đường dẫn khách mở khi quét mã của một đơn. */
export function customerUploadPath(token: string): string {
  if (!uploadTokenShape(token)) throw new Error("Mã gửi ảnh không hợp lệ.");
  return `/gui-anh/${token}`;
}
