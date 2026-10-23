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
];

export type TaskCard = {
  id: string;
  list: ChecklistListId;
  listLabel: string;
  section: string;
  title: string;
  detail: string;
  owner: string;
  role: ChecklistRole;
  due: string | null;
  repeat: ChecklistRepeat;
  shift: string;
  status: ChecklistStatus;
  photo: boolean;
  draft: boolean;
  note: string;
  fileCount: number;
  fileIds: string[];
};

type TaskState = {
  tasks?: ShopState["tasks"];
  taskChecks?: ShopState["taskChecks"];
  settings: { fixedCosts?: unknown; checklist20261023?: boolean };
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
      repeat: template.repeat,
      shift: template.shift,
      status: saved?.status ?? (template.repeat === "once" ? template.sheetStatus : "chua_lam"),
      photo: template.photo,
      draft: template.draft,
      note: saved?.note || template.note,
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

/** Thư mục Drive cho ảnh của một việc. */
export function taskFolderParts(period: string, title: string): [string, string, string] {
  const clean = title.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 70);
  return ["Việc tiệm", period, clean || "Việc"];
}

export function taskFileBucket(
  state: { tasks?: ShopState["tasks"]; taskChecks?: ShopState["taskChecks"] },
  taskId: string,
  ymd: string,
): { files: OrderFile[]; period: string; title: string } {
  const template = checklistTemplate(taskId);
  if (!template) throw new Error("Không thấy việc.");
  const period = periodFor(template, ymd);
  if (template.repeat === "once") {
    const tasks = (state.tasks ??= []);
    let row = tasks.find((item) => item.id === template.id);
    if (!row) {
      row = { id: template.id, status: template.sheetStatus, note: template.note, updatedAt: null, updatedBy: null, files: [] };
      tasks.push(row);
    }
    return { files: row.files, period, title: template.title };
  }
  const checks = (state.taskChecks ??= []);
  let row = checks.find((item) => item.taskId === template.id && item.period === period);
  if (!row) {
    row = { id: crypto.randomUUID(), taskId: template.id, period, status: "dang_lam", note: "", updatedAt: new Date().toISOString(), updatedBy: null, files: [] };
    checks.push(row);
  }
  return { files: row.files, period, title: template.title };
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
