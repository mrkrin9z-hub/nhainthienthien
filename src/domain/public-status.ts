/** Nhãn trạng thái thân thiện cho khách (gửi ảnh / tra cứu). */
export const PUBLIC_STATUS_LABEL: Record<string, string> = {
  draft_upload: "Đang gửi ảnh",
  upload_error: "Lỗi tải ảnh",
  nhan_don: "Đã nhận đơn",
  thiet_ke: "Đang thiết kế",
  cho_duyet: "Chờ khách duyệt",
  in: "Đang in",
  dong_goi: "Đang đóng gói",
  giao: "Đang giao / ship",
  xong: "Hoàn tất",
  huy: "Đã hủy",
};

export function publicStatusLabel(status: string): string {
  return PUBLIC_STATUS_LABEL[status] ?? status;
}
