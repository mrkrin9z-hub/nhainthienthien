import type { Role } from "@/domain/types";

/**
 * Nguồn sự thật cho menu Manage OS xưởng in.
 * Map StudioBase /manage → /admin. Giữ mọi module vận hành được;
 * ẩn garment / AI tools (studio-chụp). Module chưa port: bridge deep-link.
 *
 * @see docs/MANAGE_OS.md
 * @see docs/STUDIOBASE_CHAT.md
 */
export type AdminModule = {
  /** Route nội bộ Thiên Thiên */
  to: string;
  label: string;
  roles: Role[];
  /** Đường Manage tương ứng (nếu có) */
  managePath?: string;
  /** Module chỉ có ở xưởng in */
  printShopOnly?: boolean;
  /**
   * live = app nội bộ đã dùng được
   * bridge = skeleton / deep-link StudioBase (API partner chưa cover)
   */
  mode?: "live" | "bridge";
};

export type AdminModuleGroup = {
  title: string;
  items: AdminModule[];
};

export const ADMIN_MODULE_GROUPS: AdminModuleGroup[] = [
  {
    title: "",
    items: [{ to: "/admin", label: "Trang chủ", roles: ["owner", "sale", "production"], managePath: "/manage/dashboard", mode: "live" }],
  },
  {
    title: "Kinh doanh",
    items: [
      { to: "/admin/chat", label: "Chat", roles: ["owner", "sale"], managePath: "/manage/conversations", mode: "live" },
      { to: "/admin/don-hang", label: "Đơn hàng", roles: ["owner", "sale", "production"], managePath: "/manage/orders", mode: "live" },
      { to: "/admin/khach", label: "Khách hàng", roles: ["owner", "sale"], managePath: "/manage/customers", mode: "live" },
      { to: "/admin/thu", label: "Thu tiền", roles: ["owner", "sale"], managePath: "/manage/wallet", mode: "live" },
      { to: "/admin/nhac-khach", label: "Nhắc khách", roles: ["owner", "sale"], mode: "live", printShopOnly: true },
      {
        to: "/admin/studio/chien-dich",
        label: "Chiến dịch",
        roles: ["owner"],
        managePath: "/manage/campaigns",
        mode: "bridge",
      },
    ],
  },
  {
    title: "Sản xuất",
    items: [
      { to: "/admin/san-xuat", label: "Sản xuất", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" },
      { to: "/admin/giao-hang", label: "Giao hàng", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" },
      { to: "/admin/lich", label: "Lịch nhận/in", roles: ["owner", "sale", "production"], managePath: "/manage/calendar", mode: "live" },
      { to: "/admin/cong-viec", label: "Công việc", roles: ["owner", "sale", "production"], managePath: "/manage/tasks", mode: "live" },
      { to: "/admin/san-pham", label: "Sản phẩm", roles: ["owner"], managePath: "/manage/products", mode: "live" },
      { to: "/admin/gia", label: "Bảng giá", roles: ["owner", "sale"], managePath: "/manage/products", mode: "live" },
      { to: "/admin/kho", label: "Kho", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" },
      { to: "/admin/album", label: "Album / file ảnh", roles: ["owner", "sale", "production"], managePath: "/manage/photos", mode: "live" },
    ],
  },
  {
    title: "Vận hành",
    items: [
      { to: "/admin/nhan-vien", label: "Nhân viên", roles: ["owner"], managePath: "/manage/staff", mode: "live" },
      { to: "/admin/cham-cong", label: "Chấm công", roles: ["owner", "sale", "production"], managePath: "/manage/staff/attendance", mode: "live" },
      { to: "/admin/luong", label: "Lương", roles: ["owner", "sale", "production"], managePath: "/manage/staff/salary", mode: "live" },
      { to: "/admin/studio/nhom-quyen", label: "Nhóm quyền", roles: ["owner"], managePath: "/manage/settings/roles", mode: "bridge" },
      { to: "/admin/studio/bo-phan", label: "Bộ phận", roles: ["owner"], managePath: "/manage/settings/departments", mode: "bridge" },
      { to: "/admin/studio/chi-nhanh", label: "Cửa hàng", roles: ["owner"], managePath: "/manage/settings/branches", mode: "bridge" },
      { to: "/admin/tai-khoan", label: "Tài khoản", roles: ["sale", "production"], mode: "live" },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { to: "/admin/vi", label: "Ví tiền", roles: ["owner", "sale"], managePath: "/manage/wallet", mode: "live" },
      { to: "/admin/chi-phi", label: "Chi phí", roles: ["owner"], managePath: "/manage/expenses", mode: "live" },
      { to: "/admin/bao-cao-chi", label: "Báo cáo chi", roles: ["owner"], managePath: "/manage/expenses", mode: "live" },
      { to: "/admin/loi-nhuan", label: "Thu chi", roles: ["owner"], managePath: "/manage/expenses", mode: "live" },
      { to: "/admin/bao-cao", label: "Báo cáo", roles: ["owner"], managePath: "/manage/statistics", mode: "live" },
      { to: "/admin/kpi", label: "KPI", roles: ["owner", "sale"], managePath: "/manage/settings/targets", mode: "live" },
      { to: "/admin/studio/muc-tieu", label: "Mục tiêu", roles: ["owner"], managePath: "/manage/settings/targets", mode: "bridge" },
      { to: "/admin/studio/sepay", label: "SePay", roles: ["owner"], managePath: "/manage/settings/sepay", mode: "bridge" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { to: "/admin/ket-noi", label: "Kết nối", roles: ["owner"], mode: "live", printShopOnly: true },
      { to: "/admin/studio/tin-mau", label: "Tin mẫu & kênh", roles: ["owner"], managePath: "/manage/messages/settings", mode: "bridge" },
      { to: "/admin/sao-luu", label: "Sao lưu", roles: ["owner"], managePath: "/manage/settings/backup", mode: "live" },
      { to: "/admin/studio/thong-bao", label: "Thông báo đẩy", roles: ["owner"], managePath: "/manage/settings/notifications", mode: "bridge" },
      { to: "/admin/nhat-ky", label: "Nhật ký", roles: ["owner"], managePath: "/manage/activity-log", mode: "live" },
      { to: "/admin/studio/danh-gia", label: "Đánh giá ĐH", roles: ["owner", "sale"], managePath: "/manage/order-feedback", mode: "bridge" },
      { to: "/admin/studio/thong-bao-noi-bo", label: "TB nội bộ", roles: ["owner"], managePath: "/manage/announcements", mode: "bridge" },
      { to: "/admin/studio/tai-lieu", label: "Tài liệu", roles: ["owner"], managePath: "/manage/documents", mode: "bridge" },
      { to: "/admin/studio/goi", label: "Gói dịch vụ", roles: ["owner"], managePath: "/manage/subscription", mode: "bridge" },
      { to: "/admin/studio/huong-dan", label: "Hướng dẫn", roles: ["owner", "sale", "production"], managePath: "/manage/guide", mode: "bridge" },
      { to: "/admin/cai-dat", label: "Cài đặt", roles: ["owner"], managePath: "/manage/settings", mode: "live" },
    ],
  },
];

/** Module studio-chụp không mang sang xưởng in. */
export const MANAGE_SKIP = ["/manage/garments", "/manage/tools"] as const;

export function modulesForRole(role: Role): AdminModuleGroup[] {
  return ADMIN_MODULE_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
