import type { NotifyPrefs, Role, RoleModules, SePayConfig, ServicePackage } from "./types.ts";

/** Module path mặc định theo vai — khớp menu Manage OS hiện tại. */
export const DEFAULT_ROLE_MODULES: RoleModules[] = [
  {
    role: "owner",
    modules: [
      "/admin",
      "/admin/chat",
      "/admin/don-hang",
      "/admin/khach",
      "/admin/thu",
      "/admin/nhac-khach",
      "/admin/san-xuat",
      "/admin/giao-hang",
      "/admin/lich",
      "/admin/cong-viec",
      "/admin/san-pham",
      "/admin/goi",
      "/admin/gia",
      "/admin/kho",
      "/admin/album",
      "/admin/nhan-vien",
      "/admin/cham-cong",
      "/admin/luong",
      "/admin/nhom-quyen",
      "/admin/vi",
      "/admin/chi-phi",
      "/admin/bao-cao-chi",
      "/admin/loi-nhuan",
      "/admin/bao-cao",
      "/admin/kpi",
      "/admin/muc-tieu",
      "/admin/sepay",
      "/admin/ket-noi",
      "/admin/studio/tin-mau",
      "/admin/sao-luu",
      "/admin/thong-bao",
      "/admin/nhat-ky",
      "/admin/danh-gia",
      "/admin/cai-dat",
    ],
  },
  {
    role: "sale",
    modules: [
      "/admin",
      "/admin/chat",
      "/admin/don-hang",
      "/admin/khach",
      "/admin/thu",
      "/admin/nhac-khach",
      "/admin/san-xuat",
      "/admin/giao-hang",
      "/admin/lich",
      "/admin/cong-viec",
      "/admin/goi",
      "/admin/gia",
      "/admin/kho",
      "/admin/album",
      "/admin/cham-cong",
      "/admin/luong",
      "/admin/tai-khoan",
      "/admin/vi",
      "/admin/kpi",
      "/admin/danh-gia",
      "/admin/studio/tin-mau",
    ],
  },
  {
    role: "production",
    modules: [
      "/admin",
      "/admin/don-hang",
      "/admin/san-xuat",
      "/admin/giao-hang",
      "/admin/lich",
      "/admin/cong-viec",
      "/admin/kho",
      "/admin/album",
      "/admin/cham-cong",
      "/admin/luong",
      "/admin/tai-khoan",
    ],
  },
];

export const ROLE_RIGHTS_ROWS: { job: string; owner: boolean; sale: boolean; production: boolean }[] = [
  { job: "Đơn hàng", owner: true, sale: true, production: true },
  { job: "Khách hàng", owner: true, sale: true, production: false },
  { job: "Sản xuất, kho, giao", owner: true, sale: true, production: true },
  { job: "Bảng giá, thu tiền, gói dịch vụ", owner: true, sale: true, production: false },
  { job: "Nộp tiền mặt vào két", owner: true, sale: true, production: false },
  { job: "Ví cửa hàng, chi phí, giá vốn, SePay", owner: true, sale: false, production: false },
  { job: "Phân quyền, nhân viên, cài đặt", owner: true, sale: false, production: false },
  { job: "Sao lưu, nhật ký", owner: true, sale: false, production: false },
];

export function defaultSePay(): SePayConfig {
  return {
    enabled: false,
    apiKey: "",
    accountHint: "",
    webhookPath: "/api/public/sepay",
    note: "",
  };
}

export function defaultNotifyPrefs(): NotifyPrefs {
  return {
    lateOrders: true,
    marketplaceNew: true,
    feedbackReprint: true,
    cashHandover: true,
    browserPrompted: false,
  };
}

export function ensureOrgCollections(state: {
  roleModules?: RoleModules[];
  packages?: ServicePackage[];
  sepaySeen?: string[];
  announcements?: unknown[];
  documents?: unknown[];
  campaigns?: unknown[];
  messageTemplates?: unknown[];
  branches?: unknown[];
  departments?: unknown[];
  settings: { sepay?: SePayConfig; notifyPrefs?: NotifyPrefs };
}): boolean {
  let changed = false;
  if (!Array.isArray(state.roleModules) || state.roleModules.length === 0) {
    state.roleModules = DEFAULT_ROLE_MODULES.map((row) => ({
      role: row.role,
      modules: [...row.modules],
    }));
    changed = true;
  } else {
    // Chỉ gỡ path menu đã bỏ; không tự thêm module (tránh ghi đè chỉnh tay của chủ).
    const removed = new Set([
      "/admin/chi-nhanh",
      "/admin/bo-phan",
      "/admin/chien-dich",
      "/admin/thong-bao-noi-bo",
      "/admin/tai-lieu",
      "/admin/huong-dan",
      "/admin/tin-mau",
    ]);
    for (const row of state.roleModules) {
      const next = [...new Set(row.modules.map((path) => (path === "/admin/tin-mau" ? "/admin/studio/tin-mau" : path)).filter((path) => !removed.has(path)))];
      if (next.join("\0") !== row.modules.join("\0")) {
        row.modules = next;
        changed = true;
      }
    }
  }
  if (!Array.isArray(state.packages)) {
    state.packages = [];
    changed = true;
  }
  if (!Array.isArray(state.sepaySeen)) {
    state.sepaySeen = [];
    changed = true;
  }
  if (!state.settings.sepay) {
    state.settings.sepay = defaultSePay();
    changed = true;
  } else if (typeof state.settings.sepay.apiKey !== "string") {
    state.settings.sepay.apiKey = "";
    changed = true;
  }
  if (!state.settings.notifyPrefs) {
    state.settings.notifyPrefs = defaultNotifyPrefs();
    changed = true;
  }
  return changed;
}

export function modulesForStoredRole(role: Role, stored: RoleModules[] | undefined): string[] | null {
  const row = stored?.find((item) => item.role === role);
  if (!row || !Array.isArray(row.modules) || row.modules.length === 0) return null;
  return row.modules;
}

export function sortBySortThenName<T extends { sort: number; name: string }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "vi"));
}
