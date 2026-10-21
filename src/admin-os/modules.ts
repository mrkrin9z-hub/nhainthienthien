import type { Role } from "@/domain/types";

/**
 * Menu Manage OS xưởng in.
 * Kênh bán (tai_tiem / facebook / tiktok / shopee) = “nhánh” — không có màn chi nhánh/bộ phận riêng.
 * Tin mẫu & OAuth kênh → StudioBase Chat. Garment / AI tools ẩn.
 *
 * @see docs/MANAGE_OS.md
 * @see docs/STUDIOBASE_CHAT.md
 */
export type AdminModule = {
  to: string;
  label: string;
  roles: Role[];
  managePath?: string;
  printShopOnly?: boolean;
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
      { to: "/admin/goi", label: "Gói dịch vụ", roles: ["owner", "sale"], mode: "live", printShopOnly: true },
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
      { to: "/admin/nhom-quyen", label: "Nhóm quyền", roles: ["owner"], managePath: "/manage/settings/roles", mode: "live" },
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
      { to: "/admin/muc-tieu", label: "Mục tiêu", roles: ["owner"], managePath: "/manage/settings/targets", mode: "live" },
      { to: "/admin/sepay", label: "SePay", roles: ["owner"], managePath: "/manage/settings/sepay", mode: "live" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { to: "/admin/ket-noi", label: "Kết nối", roles: ["owner"], mode: "live", printShopOnly: true },
      { to: "/admin/studio/tin-mau", label: "Tin mẫu & kênh", roles: ["owner", "sale"], managePath: "/manage/messages/settings", mode: "bridge" },
      { to: "/admin/sao-luu", label: "Sao lưu", roles: ["owner"], managePath: "/manage/settings/backup", mode: "live" },
      { to: "/admin/thong-bao", label: "Thông báo đẩy", roles: ["owner"], managePath: "/manage/settings/notifications", mode: "live" },
      { to: "/admin/nhat-ky", label: "Nhật ký", roles: ["owner"], managePath: "/manage/activity-log", mode: "live" },
      { to: "/admin/danh-gia", label: "Đánh giá ĐH", roles: ["owner", "sale"], managePath: "/manage/order-feedback", mode: "live" },
      { to: "/admin/cai-dat", label: "Cài đặt", roles: ["owner"], managePath: "/manage/settings", mode: "live" },
    ],
  },
];

export const MANAGE_SKIP = ["/manage/garments", "/manage/tools"] as const;

/** Lọc menu theo role cứng, rồi theo danh sách module đã lưu (nếu có). */
export function modulesForRole(role: Role, allowedModules?: string[] | null): AdminModuleGroup[] {
  const allow = allowedModules?.length ? new Set(allowedModules) : null;
  return ADMIN_MODULE_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.roles.includes(role)) return false;
      if (!allow) return true;
      return allow.has(item.to);
    }),
  })).filter((group) => group.items.length > 0);
}
