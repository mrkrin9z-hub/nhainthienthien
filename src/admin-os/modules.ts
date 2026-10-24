import type { Role } from "@/domain/types";

/**
 * Menu quản trị — bảy mục, một lần bấm. Việc phụ nằm trong tab của trang.
 *
 * @see docs/MANAGE_OS.md
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

/** Mỗi nhóm một mục để menu phẳng. */
export const ADMIN_MODULE_GROUPS: AdminModuleGroup[] = [
  {
    title: "Tổng quan",
    items: [{ to: "/admin", label: "Tổng quan", roles: ["owner", "sale", "production"], mode: "live" }],
  },
  {
    title: "Đơn hàng",
    items: [{ to: "/admin/don-hang", label: "Đơn hàng", roles: ["owner", "sale", "production"], managePath: "/manage/orders", mode: "live" }],
  },
  {
    title: "Sản xuất",
    items: [{ to: "/admin/san-xuat", label: "Sản xuất", roles: ["owner", "production"], mode: "live" }],
  },
  {
    title: "Sản phẩm",
    items: [{ to: "/admin/gia", label: "Sản phẩm", roles: ["owner", "sale"], mode: "live" }],
  },
  {
    title: "Kho vật tư",
    items: [{ to: "/admin/kho", label: "Kho vật tư", roles: ["owner", "sale", "production"], printShopOnly: true, mode: "live" }],
  },
  {
    title: "Tiền",
    items: [{ to: "/admin/thu", label: "Tiền", roles: ["owner", "sale"], mode: "live" }],
  },
  {
    title: "Thống kê báo cáo",
    items: [{ to: "/admin/bao-cao", label: "Thống kê báo cáo", roles: ["owner"], mode: "live" }],
  },
  {
    title: "Thống kê khách hàng",
    items: [{ to: "/admin/khach", label: "Thống kê khách hàng", roles: ["owner", "sale"], mode: "live" }],
  },
  {
    title: "Nhân sự",
    items: [{ to: "/admin/viec", label: "Nhân sự", roles: ["owner", "sale", "production"], mode: "live" }],
  },
  {
    title: "Cài đặt",
    items: [{ to: "/admin/cai-dat", label: "Cài đặt", roles: ["owner"], mode: "live" }],
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
