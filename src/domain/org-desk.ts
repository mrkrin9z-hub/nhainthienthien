import type {
  Branch,
  Campaign,
  Department,
  MessageTemplate,
  NotifyPrefs,
  Role,
  RoleModules,
  SePayConfig,
} from "./types.ts";

/** Module path mặc định theo vai — khớp menu Manage OS. */
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
      "/admin/gia",
      "/admin/kho",
      "/admin/album",
      "/admin/nhan-vien",
      "/admin/cham-cong",
      "/admin/luong",
      "/admin/nhom-quyen",
      "/admin/bo-phan",
      "/admin/chi-nhanh",
      "/admin/vi",
      "/admin/chi-phi",
      "/admin/bao-cao-chi",
      "/admin/loi-nhuan",
      "/admin/bao-cao",
      "/admin/kpi",
      "/admin/muc-tieu",
      "/admin/sepay",
      "/admin/chien-dich",
      "/admin/ket-noi",
      "/admin/tin-mau",
      "/admin/sao-luu",
      "/admin/thong-bao",
      "/admin/nhat-ky",
      "/admin/danh-gia",
      "/admin/thong-bao-noi-bo",
      "/admin/tai-lieu",
      "/admin/goi",
      "/admin/huong-dan",
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
      "/admin/gia",
      "/admin/kho",
      "/admin/album",
      "/admin/cham-cong",
      "/admin/luong",
      "/admin/tai-khoan",
      "/admin/vi",
      "/admin/kpi",
      "/admin/danh-gia",
      "/admin/tin-mau",
      "/admin/huong-dan",
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
      "/admin/huong-dan",
    ],
  },
];

export const ROLE_RIGHTS_ROWS: { job: string; owner: boolean; sale: boolean; production: boolean }[] = [
  { job: "Đơn hàng", owner: true, sale: true, production: true },
  { job: "Khách hàng", owner: true, sale: true, production: false },
  { job: "Sản xuất, kho, giao", owner: true, sale: true, production: true },
  { job: "Bảng giá, thu tiền", owner: true, sale: true, production: false },
  { job: "Nộp tiền mặt vào két", owner: true, sale: true, production: false },
  { job: "Ví cửa hàng, chi phí, giá vốn", owner: true, sale: false, production: false },
  { job: "Phân quyền, chi nhánh, bộ phận", owner: true, sale: false, production: false },
  { job: "Cài đặt, sao lưu, nhật ký", owner: true, sale: false, production: false },
];

export function defaultBranches(): Branch[] {
  return [
    {
      id: "branch-main",
      name: "Cửa hàng chính",
      address: "",
      phone: "",
      active: true,
      sort: 0,
    },
  ];
}

export function defaultDepartments(): Department[] {
  return [
    { id: "dept-sale", name: "Sale", note: "Tiếp khách, chat, thu tiền", active: true, sort: 0 },
    { id: "dept-print", name: "In ấn", note: "Nhận file, in, đóng gói", active: true, sort: 1 },
    { id: "dept-ship", name: "Giao nhận", note: "Ship / giao khách", active: true, sort: 2 },
  ];
}

export function defaultSePay(): SePayConfig {
  return {
    enabled: false,
    accountHint: "",
    webhookPath: "/api/webhooks/sepay",
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

export function defaultMessageTemplates(): MessageTemplate[] {
  const at = new Date().toISOString();
  return [
    {
      id: "tpl-remind",
      title: "Nhắc khách lâu chưa in",
      kind: "remind",
      body: "Chào {ten}, Nhà In Thiên Thiên nhắc anh/chị. Lần in gần nhất cách đây {ngay} ngày. Cần in thêm thì nhắn lại giúp em nhé.",
      updatedAt: at,
    },
    {
      id: "tpl-status",
      title: "Đơn đang in",
      kind: "status",
      body: "Đơn đang in, anh/chị chờ chút nhé. Cảm ơn anh/chị đã ủng hộ Nhà In Thiên Thiên.",
      updatedAt: at,
    },
    {
      id: "tpl-done",
      title: "Đơn xong / giao",
      kind: "status",
      body: "Đơn đã hoàn tất. Cảm ơn anh/chị đã ủng hộ Nhà In Thiên Thiên.",
      updatedAt: at,
    },
  ];
}

export function ensureOrgCollections(state: {
  branches?: Branch[];
  departments?: Department[];
  roleModules?: RoleModules[];
  announcements?: unknown[];
  documents?: unknown[];
  campaigns?: Campaign[];
  messageTemplates?: MessageTemplate[];
  settings: { sepay?: SePayConfig; notifyPrefs?: NotifyPrefs };
}): boolean {
  let changed = false;
  if (!Array.isArray(state.branches) || state.branches.length === 0) {
    state.branches = defaultBranches();
    changed = true;
  }
  if (!Array.isArray(state.departments) || state.departments.length === 0) {
    state.departments = defaultDepartments();
    changed = true;
  }
  if (!Array.isArray(state.roleModules) || state.roleModules.length === 0) {
    state.roleModules = DEFAULT_ROLE_MODULES.map((row) => ({
      role: row.role,
      modules: [...row.modules],
    }));
    changed = true;
  }
  if (!Array.isArray(state.announcements)) {
    state.announcements = [];
    changed = true;
  }
  if (!Array.isArray(state.documents)) {
    state.documents = [];
    changed = true;
  }
  if (!Array.isArray(state.campaigns)) {
    state.campaigns = [];
    changed = true;
  }
  if (!Array.isArray(state.messageTemplates) || state.messageTemplates.length === 0) {
    state.messageTemplates = defaultMessageTemplates();
    changed = true;
  }
  if (!state.settings.sepay) {
    state.settings.sepay = defaultSePay();
    changed = true;
  }
  if (!state.settings.notifyPrefs) {
    state.settings.notifyPrefs = defaultNotifyPrefs();
    changed = true;
  }
  return changed;
}

export const SUBSCRIPTION_FEATURES: { title: string; body: string; local: boolean }[] = [
  { title: "Chat + đơn từ hội thoại", body: "Partner Chat API StudioBase.", local: true },
  { title: "Đơn / QR / album / kho", body: "Domain xưởng in trên Workers/KV.", local: true },
  { title: "Ví, chi phí, KPI, mục tiêu", body: "Sổ tiền và KPI local.", local: true },
  { title: "Chi nhánh / bộ phận / quyền", body: "Tổ chức nhân sự local.", local: true },
  { title: "Kết nối Fanpage / Zalo OAuth", body: "Cấu hình kênh trên StudioBase Manage.", local: false },
  { title: "Web Push / VAPID", body: "Thông báo đẩy trình duyệt trên StudioBase.", local: false },
  { title: "Gói thanh toán StudioBase", body: "Subscription owner trên Manage.", local: false },
];

export const MESSAGE_KIND_LABEL: Record<string, string> = {
  remind: "Nhắc khách",
  status: "Tình trạng đơn",
  chat: "Chat",
  other: "Khác",
};

export function modulesForStoredRole(role: Role, stored: RoleModules[] | undefined): string[] | null {
  const row = stored?.find((item) => item.role === role);
  if (!row || !Array.isArray(row.modules) || row.modules.length === 0) return null;
  return row.modules;
}

export function sortBySortThenName<T extends { sort: number; name: string }>(rows: T[]): T[] {
  return rows.slice().sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "vi"));
}

export const PRINT_GUIDE_SECTIONS: { title: string; body: string }[] = [
  {
    title: "Luồng đơn in",
    body: "Nhận đơn → nhận file (QR/album) → xử lý trước in → khách duyệt (nếu cần) → in → đóng gói → giao. Theo dõi trên Lịch và Công việc.",
  },
  {
    title: "Thu tiền & ví",
    body: "Sale thu tiền mặt / chuyển khoản trên Thu tiền. Tiền mặt đang giữ nộp vào két qua Nộp tiền. Chi phí ghi ở Chi phí; xem tổng ở Báo cáo chi.",
  },
  {
    title: "Chi nhánh & bộ phận",
    body: "Gán nhân viên vào cửa hàng và bộ phận ở Nhân viên. Danh sách cửa hàng / bộ phận sửa ở menu Vận hành.",
  },
  {
    title: "Đánh giá sau giao",
    body: "Khách mở link đánh giá trên đơn đã giao. Sai màu / sai khổ tự mở phiếu in lại. Xem danh sách ở Đánh giá ĐH.",
  },
];
