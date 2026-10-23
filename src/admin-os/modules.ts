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

/** Việc hằng ngày của tiệm. Mỗi việc là một mục, mở từ nhóm — tối đa hai lần bấm. */
export const ADMIN_MODULE_GROUPS: AdminModuleGroup[] = [
  {
    title: "Đơn hàng",
    items: [
      { to: "/admin/don-hang", label: "Nhận đơn", roles: ["owner", "sale", "production"], managePath: "/manage/orders", mode: "live" },
      { to: "/admin/don-moi", label: "Nhập/Tạo đơn", roles: ["owner", "sale"], mode: "live" },
      { to: "/admin/in-don", label: "In đơn (K80)", roles: ["owner", "sale", "production"], mode: "live" },
      { to: "/admin/giao-hang", label: "Giao đơn", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" },
    ],
  },
  {
    title: "Nhân sự",
    items: [
      { to: "/admin/viec", label: "Việc cần làm", roles: ["owner", "sale", "production"], mode: "live" },
      { to: "/admin/cham-cong", label: "Chấm công", roles: ["owner", "sale", "production"], managePath: "/manage/staff/attendance", mode: "live" },
      { to: "/admin/check-cong", label: "Check công", roles: ["owner", "sale", "production"], mode: "live" },
      { to: "/admin/luong", label: "Check lương", roles: ["owner", "sale", "production"], managePath: "/manage/staff/salary", mode: "live" },
      { to: "/admin/thuong", label: "Check thưởng", roles: ["owner", "sale"], mode: "live" },
    ],
  },
  {
    title: "Thu chi",
    items: [
      { to: "/admin/thu", label: "Nhập thu", roles: ["owner", "sale"], managePath: "/manage/wallet", mode: "live" },
      { to: "/admin/chuyen-nop", label: "Chuyển nộp", roles: ["owner", "sale"], mode: "live" },
      { to: "/admin/chi-phi", label: "Nhập chi", roles: ["owner", "sale"], managePath: "/manage/expenses", mode: "live" },
      { to: "/admin/duyet-chi", label: "Duyệt chi", roles: ["owner"], mode: "live" },
      { to: "/admin/cong-no", label: "Công nợ", roles: ["owner", "sale"], mode: "live" },
    ],
  },
  {
    title: "Báo cáo",
    items: [
      { to: "/admin/bao-cao", label: "Báo cáo tổng", roles: ["owner"], managePath: "/manage/statistics", mode: "live" },
      { to: "/admin/bao-cao-chi", label: "Báo cáo chi phí", roles: ["owner"], managePath: "/manage/expenses", mode: "live" },
      { to: "/admin/loi-nhuan", label: "Lợi nhuận", roles: ["owner"], mode: "live" },
    ],
  },
  {
    title: "Kho",
    items: [
      { to: "/admin/san-pham", label: "Tồn kho sản phẩm", roles: ["owner", "sale"], managePath: "/manage/products", mode: "live" },
      { to: "/admin/san-pham", label: "Nhập sản phẩm", roles: ["owner"], search: { m: "nhap" }, mode: "live" },
      { to: "/admin/kho", label: "Nhập vật tư", roles: ["owner", "sale"], search: { m: "nhap" }, printShopOnly: true, mode: "live" },
      { to: "/admin/kho", label: "Tồn kho vật tư", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" },
      { to: "/admin/kho", label: "Báo hỏng", roles: ["owner", "sale", "production"], search: { m: "hong" }, printShopOnly: true, mode: "live" },
    ],
  },
  {
    title: "Cài đặt",
    items: [
      { to: "/admin/gia", label: "Bảng giá", roles: ["owner", "sale"], mode: "live" },
      { to: "/admin/cai-dat", label: "Giá vốn", roles: ["owner"], search: { m: "chi-phi" }, mode: "live" },
      { to: "/admin/cai-dat", label: "Kênh bán", roles: ["owner"], search: { m: "kenh" }, mode: "live" },
      { to: "/admin/nhan-vien", label: "Nhân viên", roles: ["owner"], managePath: "/manage/staff", mode: "live" },
      { to: "/admin/nhom-quyen", label: "Nhóm quyền", roles: ["owner"], managePath: "/manage/settings/roles", mode: "live" },
      { to: "/admin/ket-noi", label: "Kết nối", roles: ["owner"], mode: "live", printShopOnly: true },
      { to: "/admin/cai-dat", label: "Cửa hàng", roles: ["owner"], search: { m: "cua-hang" }, mode: "live" },
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
