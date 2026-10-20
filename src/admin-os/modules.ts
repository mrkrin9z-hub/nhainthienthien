import type { Role } from "@/domain/types";

/**
 * Nguồn sự thật cho menu Manage OS xưởng in.
 * Map từ StudioBase /manage → /admin, bỏ module studio-only,
 * thêm module xưởng (sản xuất, giao, kho, cost).
 *
 * Khi có source PhotoShare Manage: port shell/luồng vào đây,
 * adapters gọi domain Thiên Thiên — không merge DB studio.
 *
 * @see docs/MANAGE_OS.md
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
};

export type AdminModuleGroup = {
  title: string;
  items: AdminModule[];
};

export const ADMIN_MODULE_GROUPS: AdminModuleGroup[] = [
  {
    title: "",
    items: [{ to: "/admin", label: "Trang chủ", roles: ["owner", "sale", "production"], managePath: "/manage/dashboard" }],
  },
  {
    title: "Kinh doanh",
    items: [
      { to: "/admin/chat", label: "Chat", roles: ["owner", "sale"], managePath: "/manage/conversations" },
      { to: "/admin/don-hang", label: "Đơn hàng", roles: ["owner", "sale", "production"], managePath: "/manage/orders" },
      { to: "/admin/khach", label: "Khách hàng", roles: ["owner", "sale"], managePath: "/manage/customers" },
      { to: "/admin/thu", label: "Thu tiền", roles: ["owner", "sale"], managePath: "/manage/wallet" },
    ],
  },
  {
    title: "Sản xuất",
    items: [
      { to: "/admin/san-xuat", label: "Sản xuất", roles: ["owner", "sale", "production"], printShopOnly: true },
      { to: "/admin/giao-hang", label: "Giao hàng", roles: ["owner", "sale", "production"], printShopOnly: true },
      { to: "/admin/san-pham", label: "Sản phẩm", roles: ["owner"], managePath: "/manage/products" },
      { to: "/admin/gia", label: "Bảng giá", roles: ["owner", "sale"], managePath: "/manage/products" },
      { to: "/admin/kho", label: "Kho", roles: ["owner", "sale", "production"], printShopOnly: true },
      { to: "/admin/album", label: "Album ảnh", roles: ["owner", "sale", "production"], managePath: "/manage/photos" },
    ],
  },
  {
    title: "Vận hành",
    items: [
      { to: "/admin/nhan-vien", label: "Nhân viên", roles: ["owner"] },
      { to: "/admin/cham-cong", label: "Chấm công", roles: ["owner", "sale", "production"] },
      { to: "/admin/tai-khoan", label: "Tài khoản", roles: ["sale", "production"] },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { to: "/admin/vi", label: "Ví tiền", roles: ["owner", "sale"], managePath: "/manage/wallet" },
      { to: "/admin/chi-phi", label: "Chi phí", roles: ["owner"], managePath: "/manage/expenses" },
      { to: "/admin/loi-nhuan", label: "Thu chi", roles: ["owner"], managePath: "/manage/expenses" },
      { to: "/admin/bao-cao", label: "Báo cáo", roles: ["owner"], managePath: "/manage/statistics" },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { to: "/admin/nhat-ky", label: "Nhật ký", roles: ["owner"], managePath: "/manage/activity-log" },
      { to: "/admin/cai-dat", label: "Cài đặt", roles: ["owner"] },
    ],
  },
];

/** Module studio Manage không mang sang xưởng. */
export const MANAGE_SKIP = [
  "/manage/calendar",
  "/manage/garments",
  "/manage/campaigns",
  "/manage/tasks",
  "/manage/announcements",
  "/manage/documents",
  "/manage/tools",
] as const;

export function modulesForRole(role: Role): AdminModuleGroup[] {
  return ADMIN_MODULE_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
