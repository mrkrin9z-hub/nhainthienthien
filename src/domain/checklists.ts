import { vnYmd } from "./calc.ts";
import {
  CHECKLIST_TEMPLATES,
  type ChecklistListId,
  type ChecklistRepeat,
  type ChecklistRole,
  type ChecklistStatus,
  type ChecklistTemplate,
} from "./checklist-catalog.ts";
import type { OrderFile, Role, ShopState } from "./types.ts";

export type { ChecklistListId, ChecklistStatus, ChecklistTemplate };

export const LIST_LABEL: Record<ChecklistListId, string> = {
  sale_ngay: "Hằng ngày",
  sop: "Mốc giờ",
  sale_tuan: "Hằng tuần",
  setup: "Setup tiệm",
  khai_truong: "Khai trương",
  chot: "24 việc chốt",
  anh: "Chụp ảnh",
  dao_tao: "Đào tạo",
};

export const PHOTO_GUIDE_URL = "https://drive.google.com/file/d/10s9AdkzMF9zLqZqLSwCBrRUyodvnm2Is/view";
export const VIDEO_GUIDE_URL = "https://drive.google.com/file/d/1F6cDFHSLaOw3F3PRZ6CFB0kxYXF29FGQ/view";

export const TASK_DOCS = [
  { title: "Hướng dẫn chụp ảnh", href: PHOTO_GUIDE_URL },
  { title: "Hướng dẫn quay video", href: VIDEO_GUIDE_URL },
] as const;

export const SHOP_RULES = [
  "Không in khi khách chưa duyệt bản xem trước.",
  "Không hủy đơn vì làm không kịp. Báo chủ.",
  "Không ghi số điện thoại, Zalo hay địa chỉ trên chat sàn, ảnh, listing.",
  "Không hứa quà kèm và không tự giảm ngoài bảng giá.",
  "Tin tiêu cực hoặc khiếu nại: chụp màn hình gửi chủ, không tự trả lời.",
  "Không đăng ảnh khách khi khách chưa đồng ý.",
  "Cọc với đơn từ 300.000đ hoặc có ảnh từ 40×60. Facebook thu phần còn lại khi giao.",
] as const;

export type SheetCoverage = { sheet: string; inApp: string; gap: string };

/** Đối chiếu tab sheet với chỗ đang sống trong app. gap rỗng = đã có việc hoặc số liệu tương ứng. */
export const SHEET_COVERAGE: SheetCoverage[] = [
  { sheet: "Bảng giá chung 22/10", inApp: "Bảng giá", gap: "" },
  { sheet: "Hòa vốn KPI", inApp: "Lợi nhuận, Check lương, Check thưởng", gap: "" },
  { sheet: "Bảng giá 19/10 từng kênh", inApp: "Đã thay bằng giá chung 22/10", gap: "" },
  { sheet: "Phí sàn, ship Facebook, chi phí cố định", inApp: "Cài đặt chi phí", gap: "" },
  { sheet: "Giá Shopee nháp, showroom 16/10", inApp: "Không phát hành", gap: "Giữ ngoài app vì là bảng cũ, không phải giá đang bán." },
  { sheet: "Sổ đơn, doanh thu ngày, tổng tháng", inApp: "Đơn hàng, Báo cáo tổng", gap: "" },
  { sheet: "Tồn kho, nhập xuất", inApp: "Tồn kho vật tư", gap: "Số lượng tồn vẫn Chưa đếm cho đến khi đếm thật. Mức tối thiểu đã vào app." },
  { sheet: "Dashboard", inApp: "Báo cáo tổng", gap: "" },
  { sheet: "Checklist setup tiệm 22/10", inApp: "Việc cần làm · Setup tiệm", gap: "" },
  { sheet: "Checklist việc cần làm / khai trương", inApp: "Việc cần làm · Khai trương", gap: "" },
  { sheet: "Lịch chốt 24 việc", inApp: "Việc cần làm · 24 việc chốt", gap: "" },
  { sheet: "Checklist ảnh nhân viên", inApp: "Việc cần làm · Chụp ảnh", gap: "" },
  { sheet: "Checklist sale hằng ngày và tuần", inApp: "Việc cần làm · Hằng ngày / Hằng tuần", gap: "Chỉ tiêu 12 đơn và 1.640.000đ/ngày vẫn là nháp trong chi tiết việc, không ghi đè KPI đã duyệt." },
  { sheet: "Danh sách công việc sale", inApp: "Các việc hằng ngày và tuần", gap: "" },
  { sheet: "Báo cáo tháng sale", inApp: "Báo cáo tổng và KPI đã duyệt", gap: "Mốc 49,1 triệu trong sheet là bản nháp. KPI đang chạy là mốc chủ đã duyệt." },
  { sheet: "SOP xử lý đơn", inApp: "Trạng thái đơn, cổng ảnh duyệt, cổng đóng gói, mốc giờ", gap: "" },
  { sheet: "Đào tạo nhân viên", inApp: "Việc cần làm · Đào tạo", gap: "Không chép đáp án giá trong tài liệu 17/10. Giá lấy ở Bảng giá." },
  { sheet: "Chính sách bảo hành", inApp: "Nội quy trên Việc cần làm, phiếu in lại", gap: "Chưa có trang chính sách cho khách. Câu không thu thêm khi lỗi xưởng chỉ hiện nội bộ." },
  { sheet: "Kế hoạch A–Z 22/10", inApp: "Quy tắc copy, giá, việc setup", gap: "Lịch đăng bài từng ngày chưa thành lịch riêng." },
  { sheet: "Đặc tả web quản trị", inApp: "App này", gap: "" },
  { sheet: "Bảng giá Mơ Home", inApp: "Kênh Mơ Home (nội bộ), giá để trống", gap: "Không thấy bảng giá trong file import hay Drive. Cần mã, tên, khổ, số tấm, giá nội bộ và vốn vật tư." },
];

export type DeskAssignee = "admin" | "sale" | "production";
export type TaskPriority = "cao" | "vua" | "thap";

export const ASSIGNEE_LABEL: Record<DeskAssignee, string> = {
  admin: "Admin",
  sale: "Sale",
  production: "Sản xuất",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  cao: "Cao",
  vua: "Vừa",
  thap: "Thấp",
};

export const STATUS_WORD: Record<ChecklistStatus, string> = {
  chua_lam: "Cần làm",
  dang_lam: "Đang làm",
  xong: "Xong",
};

const PROOF_SECTIONS = new Set([
  "Cần chụp",
  "Quay video",
  "Video xưởng",
  "Ảnh sản phẩm thật",
  "Kệ, quầy, trưng bày",
  "Ảnh in demo (mẫu trưng bày)",
  "Showroom",
]);

/** Ảnh chứng chỉ khi việc là chụp sản phẩm, quay video hoặc setup kệ. Hóa đơn và câu "không cần chụp" thì không. */
export function needsProof(template: Pick<ChecklistTemplate, "title" | "section">): boolean {
  const title = template.title;
  const text = `${title} ${template.section}`;
  if (/không cần chụp|ảnh hóa đơn|chứng từ/i.test(text)) return false;
  if (/^(chọn |duyệt |chốt |quyết |giao nhân viên|hỏi |quy định)/i.test(title)) return false;
  if (template.section === "Showroom tại tiệm") return /kệ|trưng bày|chụp/i.test(title);
  if (template.section === "Đèn & góc chụp sản phẩm") return /chụp/i.test(title);
  if (PROOF_SECTIONS.has(template.section)) return true;
  return /chụp ảnh thật|quay video|chụp mặt tiền|kệ trưng bày/i.test(title);
}

/** Thư mục Drive theo nhóm việc, không theo ngày. */
export function taskGroupFolder(template: Pick<ChecklistTemplate, "title" | "section" | "list">): string {
  const title = template.title;
  if (template.section === "Cần chụp" || /chụp ảnh thật|chụp mặt tiền/i.test(title)) return "Cần chụp";
  if (template.section === "Quay video" || template.section === "Video xưởng" || /quay video/i.test(title)) return "Quay video";
  if (
    /kệ/i.test(template.section) ||
    /kệ trưng bày/i.test(title) ||
    template.section === "Ảnh in demo (mẫu trưng bày)" ||
    template.section === "Showroom" ||
    template.section === "Showroom tại tiệm"
  ) {
    return "Setup kệ";
  }
  return LIST_LABEL[template.list];
}

function ownerPerson(owner: string): boolean {
  const text = owner.trim().toLowerCase();
  if (/sale|sản xuất|nhân viên|em |cả tiệm|\/ nv|\bnv\b/.test(text)) return false;
  return /chủ|việt|anh/.test(text);
}

/** Việc của chủ = Admin. Sale và sản xuất theo vai. Việc "cả tiệm" chia theo nội dung. */
export function deskAssignee(template: Pick<ChecklistTemplate, "role" | "owner" | "title" | "section" | "detail">): DeskAssignee {
  if (template.role === "sale") return "sale";
  if (template.role === "production") return "production";
  if (template.role === "owner") return "admin";
  if (ownerPerson(template.owner)) return "admin";
  const title = template.title.toLowerCase();
  const blob = `${title} ${template.section} ${template.detail}`.toLowerCase();
  if (/^(duyệt|chốt|quyết|giao nhân viên|chọn nhân viên)/.test(title)) return "admin";
  if (/chụp|quay|kệ|trưng bày|đóng gói|ép gỗ|máy in|máy ép|cân đo|in mẫu|showroom|vật tư/.test(blob)) return "production";
  if (/đăng |inbox|listing|tiktok|shopee|facebook|nội dung|content|bàn giao đơn|seller|chat/.test(blob)) return "sale";
  return "admin";
}

export function taskPriority(template: Pick<ChecklistTemplate, "due" | "repeat" | "list">): TaskPriority {
  if (template.repeat === "daily") return "cao";
  if (template.repeat === "weekly") return "vua";
  const due = template.due ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    if (due <= "2026-11-07") return "cao";
    if (due <= "2026-12-01") return "vua";
    return "thap";
  }
  if (template.list === "dao_tao") return "thap";
  if (template.list === "anh" || template.list === "setup" || template.list === "khai_truong" || template.list === "chot") return "vua";
  return "thap";
}

export function mineAssignee(role: Role): DeskAssignee {
  if (role === "sale") return "sale";
  if (role === "production") return "production";
  return "admin";
}

export type TaskCard = {
  id: string;
  list: ChecklistListId;
  listLabel: string;
  section: string;
  title: string;
  detail: string;
  owner: string;
  role: ChecklistRole;
  assignee: DeskAssignee;
  assigneeLabel: string;
  due: string | null;
  priority: TaskPriority;
  priorityLabel: string;
  repeat: ChecklistRepeat;
  shift: string;
  status: ChecklistStatus;
  photo: boolean;
  needsProof: boolean;
  driveFolder: string;
  draft: boolean;
  note: string;
  link: string;
  fileCount: number;
  fileIds: string[];
};

type TaskState = {
  tasks?: ShopState["tasks"];
  taskChecks?: ShopState["taskChecks"];
  settings: { fixedCosts?: unknown; checklist20261023?: boolean; checklistGuides20261024?: boolean };
  roleModules?: { role: string; modules: string[] }[];
};

export function checklistTemplate(id: string): ChecklistTemplate | undefined {
  return CHECKLIST_TEMPLATES.find((item) => item.id === id);
}

export function weekKey(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - start.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function periodFor(template: ChecklistTemplate, ymd: string): string {
  if (template.repeat === "daily") return ymd;
  if (template.repeat === "weekly") return weekKey(ymd);
  return "once";
}

function filesOf(files: OrderFile[] | undefined): OrderFile[] {
  return (files ?? []).filter((file) => !file.deletedAt && file.status === "complete");
}

export function checklistCards(state: { tasks?: ShopState["tasks"]; taskChecks?: ShopState["taskChecks"] }, ymd: string): TaskCard[] {
  const once = new Map((state.tasks ?? []).map((task) => [task.id, task]));
  const checks = state.taskChecks ?? [];
  return CHECKLIST_TEMPLATES.map((template) => {
    const period = periodFor(template, ymd);
    const saved = template.repeat === "once" ? once.get(template.id) : checks.find((row) => row.taskId === template.id && row.period === period);
    const files = filesOf(saved?.files);
    const link = template.link;
    const savedNote = saved?.note || template.note;
    return {
      id: template.id,
      list: template.list,
      listLabel: LIST_LABEL[template.list],
      section: template.section,
      title: template.title,
      detail: template.detail,
      owner: template.owner,
      role: template.role,
      due: template.due,
      assignee: deskAssignee(template),
      assigneeLabel: ASSIGNEE_LABEL[deskAssignee(template)],
      priority: taskPriority(template),
      priorityLabel: PRIORITY_LABEL[taskPriority(template)],
      repeat: template.repeat,
      shift: template.shift,
      status: saved?.status ?? (template.repeat === "once" ? template.sheetStatus : "chua_lam"),
      photo: template.photo,
      needsProof: needsProof(template),
      driveFolder: taskFolderParts(taskGroupFolder(template), template.title).join(" / "),
      draft: template.draft,
      note: link && savedNote.trim() === link ? "" : savedNote,
      link,
      fileCount: files.length,
      fileIds: files.map((file) => file.id),
    };
  });
}

export function checklistBadge(state: { tasks?: ShopState["tasks"]; taskChecks?: ShopState["taskChecks"] }, ymd = vnYmd()): number {
  return checklistCards(state, ymd).filter((card) => {
    if (card.status === "xong") return false;
    if (card.repeat !== "once") return true;
    return card.due !== null && card.due <= ymd;
  }).length;
}

const STATUS_OK: ChecklistStatus[] = ["chua_lam", "dang_lam", "xong"];

export function applyTaskStatus(
  state: { tasks?: ShopState["tasks"]; taskChecks?: ShopState["taskChecks"] },
  input: { taskId: string; status: ChecklistStatus; note?: string; by: string | null; ymd: string; at: string },
): { period: string; title: string } {
  const template = checklistTemplate(input.taskId);
  if (!template) throw new Error("Không thấy việc.");
  if (!STATUS_OK.includes(input.status)) throw new Error("Trạng thái không hợp lệ.");
  const note = (input.note ?? "").trim().slice(0, 400);
  if (template.repeat === "once") {
    const tasks = (state.tasks ??= []);
    let row = tasks.find((item) => item.id === template.id);
    if (!row) {
      row = { id: template.id, status: template.sheetStatus, note: template.note, updatedAt: null, updatedBy: null, files: [] };
      tasks.push(row);
    }
    row.status = input.status;
    if (note) row.note = note;
    row.updatedAt = input.at;
    row.updatedBy = input.by;
    return { period: "once", title: template.title };
  }
  const period = periodFor(template, input.ymd);
  const checks = (state.taskChecks ??= []);
  let row = checks.find((item) => item.taskId === template.id && item.period === period);
  if (!row) {
    row = { id: crypto.randomUUID(), taskId: template.id, period, status: "chua_lam", note: "", updatedAt: input.at, updatedBy: input.by, files: [] };
    checks.push(row);
  }
  row.status = input.status;
  if (note) row.note = note;
  row.updatedAt = input.at;
  row.updatedBy = input.by;
  return { period, title: template.title };
}

/** Thư mục Drive cho ảnh của một việc: Việc tiệm / nhóm / tên việc. */
export function taskFolderParts(group: string, title: string): [string, string, string] {
  const clean = title.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
  const folder = group.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "Việc";
  return ["Việc tiệm", folder, clean || "Việc"];
}

export function taskFileBucket(
  state: { tasks?: ShopState["tasks"]; taskChecks?: ShopState["taskChecks"] },
  taskId: string,
  ymd: string,
): { files: OrderFile[]; period: string; title: string; group: string } {
  const template = checklistTemplate(taskId);
  if (!template) throw new Error("Không thấy việc.");
  const period = periodFor(template, ymd);
  const group = taskGroupFolder(template);
  if (template.repeat === "once") {
    const tasks = (state.tasks ??= []);
    let row = tasks.find((item) => item.id === template.id);
    if (!row) {
      row = { id: template.id, status: template.sheetStatus, note: template.note, updatedAt: null, updatedBy: null, files: [] };
      tasks.push(row);
    }
    return { files: row.files, period, title: template.title, group };
  }
  const checks = (state.taskChecks ??= []);
  let row = checks.find((item) => item.taskId === template.id && item.period === period);
  if (!row) {
    row = { id: crypto.randomUUID(), taskId: template.id, period, status: "dang_lam", note: "", updatedAt: new Date().toISOString(), updatedBy: null, files: [] };
    checks.push(row);
  }
  return { files: row.files, period, title: template.title, group };
}

const MENU_PATH = "/admin/viec";

/** Đưa việc một lần vào sổ. Chỉ chạy khi tiệm đã có định phí, để sổ trống trong test không bị ghi. */
export function ensureChecklistTasks(state: TaskState): boolean {
  if (!state.settings.fixedCosts) return false;
  let changed = false;
  const tasks = (state.tasks ??= []);
  if (!state.taskChecks) {
    state.taskChecks = [];
    changed = true;
  }
  const have = new Set(tasks.map((task) => task.id));
  for (const template of CHECKLIST_TEMPLATES) {
    if (template.repeat !== "once" || have.has(template.id)) continue;
    tasks.push({
      id: template.id,
      status: template.sheetStatus,
      note: template.note,
      updatedAt: null,
      updatedBy: null,
      files: [],
    });
    changed = true;
  }
  if (state.settings.checklistGuides20261024 !== true) {
    const doneNote = new Map([
      ["anh-13", "Kho ảnh 23/10 đã có ảnh dùng được. Không chụp lại."],
      ["anh-14", "Kho ảnh 23/10 đã có ảnh dùng được. Không chụp lại."],
      ["anh-15", "Kho ảnh 23/10 đã có ảnh dùng được. Không chụp lại."],
      ["anh-16", "Kho ảnh 23/10 đã có ảnh dùng được. Không chụp lại."],
      ["anh-17", "Kho ảnh 23/10 đã có ảnh dùng được. Không chụp lại."],
      ["anh-18", "Kho ảnh 23/10 đã có ảnh dùng được. Không chụp lại."],
      ["anh-25", "Việc còn lại là nam châm tủ lạnh 6×9 trong nhóm Cần chụp."],
    ]);
    for (const [id, note] of doneNote) {
      const row = tasks.find((item) => item.id === id);
      if (!row || row.updatedBy || row.status !== "chua_lam") continue;
      row.status = "xong";
      row.note = note;
      changed = true;
    }
    state.settings.checklistGuides20261024 = true;
    changed = true;
  }
  for (const row of state.roleModules ?? []) {
    if (!row.modules.includes(MENU_PATH)) {
      row.modules.push(MENU_PATH);
      changed = true;
    }
  }
  if (state.settings.checklist20261023 !== true) {
    state.settings.checklist20261023 = true;
    changed = true;
  }
  return changed;
}

export function checklistForRole(cards: TaskCard[], role: Role | "all"): TaskCard[] {
  if (role === "owner" || role === "all") return cards;
  return cards.filter((card) => card.role === "all" || card.role === role);
}

export function orderStepKind(step: string): "original" | "design" | "approval" | "packing_photo" {
  if (step === "thiet-ke") return "design";
  if (step === "duyet") return "approval";
  if (step === "goi") return "packing_photo";
  return "original";
}

export function orderStepLabel(step: string): string {
  if (step === "thiet-ke") return "Bản thiết kế";
  if (step === "duyet") return "Ảnh duyệt";
  if (step === "goi") return "Ảnh đóng gói";
  return "Ảnh khách";
}
