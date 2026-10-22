import type { Role } from "@/domain/types";

/**
 * Menu Manage OS xưởng in — toàn bộ live local, độc lập StudioBase.
 * StudioBase chỉ dùng ở Kết nối để ủy quyền Facebook (không đăng ký Dev App mới).
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
  mode?: "live";
  /** Search gắn với route, ví dụ panel Giá vốn trong Cài đặt. */
  search?: Record<string, string>;
};

export type AdminModuleGroup = {
  title: string;
  items: AdminModule[];
};

export const ADMIN_MODULE_GROUPS: AdminModuleGroup[] = [
  {
    title: "Tổng quan",
    items: [{ to: "/admin", label: "Tổng quan", roles: ["owner", "sale", "production"], managePath: "/manage/dashboard", mode: "live" }],
  },
  {
    title: "Bán hàng",
    items: [
      { to: "/admin/don-hang", label: "Đơn hàng", roles: ["owner", "sale", "production"], managePath: "/manage/orders", mode: "live" },
      { to: "/admin/don-moi", label: "Lên đơn", roles: ["owner", "sale"], mode: "live" },
      { to: "/admin/giao-hang", label: "Giao hàng", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" },
      { to: "/admin/cod", label: "COD", roles: ["owner", "sale"], mode: "live" },
      { to: "/admin/khach", label: "Khách hàng", roles: ["owner", "sale"], managePath: "/manage/customers", mode: "live" },
      { to: "/admin/chat", label: "Chat", roles: ["owner", "sale"], mode: "live" },
      { to: "/admin/nhap-don", label: "Nhập đơn sàn", roles: ["owner", "sale"], mode: "live" },
    ],
  },
  {
    title: "Sản xuất",
    items: [
      { to: "/admin/san-xuat", label: "Lệnh sản xuất", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" },
      { to: "/admin/lich", label: "Lịch", roles: ["owner", "sale", "production"], managePath: "/manage/calendar", mode: "live" },
      { to: "/admin/kho", label: "Tồn kho", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" },
      { to: "/admin/album", label: "Album / file ảnh", roles: ["owner", "sale", "production"], managePath: "/manage/photos", mode: "live" },
    ],
  },
  {
    title: "Sản phẩm & Giá",
    items: [
      { to: "/admin/san-pham", label: "Sản phẩm", roles: ["owner"], managePath: "/manage/products", mode: "live" },
      { to: "/admin/gia", label: "Bảng giá theo kênh", roles: ["owner", "sale"], managePath: "/manage/products", mode: "live" },
      { to: "/admin/cai-dat", label: "Giá vốn", roles: ["owner"], search: { m: "chi-phi" }, mode: "live" },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { to: "/admin/thu", label: "Thu tiền", roles: ["owner", "sale"], managePath: "/manage/wallet", mode: "live" },
      { to: "/admin/chi-phi", label: "Chi phí", roles: ["owner"], managePath: "/manage/expenses", mode: "live" },
      { to: "/admin/vi", label: "Ví tiền", roles: ["owner", "sale"], managePath: "/manage/wallet", mode: "live" },
      { to: "/admin/bao-cao", label: "Báo cáo", roles: ["owner"], managePath: "/manage/statistics", mode: "live" },
      { to: "/admin/bao-cao-chi", label: "Báo cáo chi", roles: ["owner"], managePath: "/manage/expenses", mode: "live" },
      { to: "/admin/loi-nhuan", label: "Lợi nhuận", roles: ["owner"], managePath: "/manage/expenses", mode: "live" },
    ],
  },
  {
    title: "Nhân sự",
    items: [
      { to: "/admin/nhan-vien", label: "Nhân viên", roles: ["owner"], managePath: "/manage/staff", mode: "live" },
      { to: "/admin/cham-cong", label: "Chấm công", roles: ["owner", "sale", "production"], managePath: "/manage/staff/attendance", mode: "live" },
      { to: "/admin/luong", label: "Lương", roles: ["owner", "sale", "production"], managePath: "/manage/staff/salary", mode: "live" },
      { to: "/admin/kpi", label: "KPI và hoa hồng", roles: ["owner", "sale"], managePath: "/manage/settings/targets", mode: "live" },
      { to: "/admin/muc-tieu", label: "Mục tiêu", roles: ["owner"], managePath: "/manage/settings/targets", mode: "live" },
      { to: "/admin/tai-khoan", label: "Tài khoản", roles: ["sale", "production"], mode: "live" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { to: "/admin/cai-dat", label: "Cài đặt", roles: ["owner"], managePath: "/manage/settings", mode: "live" },
      { to: "/admin/ket-noi", label: "Kết nối", roles: ["owner"], mode: "live", printShopOnly: true },
      { to: "/admin/sao-luu", label: "Sao lưu", roles: ["owner"], managePath: "/manage/settings/backup", mode: "live" },
      { to: "/admin/nhat-ky", label: "Nhật ký", roles: ["owner"], managePath: "/manage/activity-log", mode: "live" },
      { to: "/admin/thong-bao", label: "Thông báo", roles: ["owner"], managePath: "/manage/settings/notifications", mode: "live" },
      { to: "/admin/tin-mau", label: "Tin mẫu", roles: ["owner", "sale"], mode: "live" },
      { to: "/admin/nhom-quyen", label: "Nhóm quyền", roles: ["owner"], managePath: "/manage/settings/roles", mode: "live" },
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
