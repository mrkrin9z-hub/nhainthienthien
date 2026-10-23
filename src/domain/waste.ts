import { vnMonth, vnYmd } from "./calc.ts";
import { orderInScope, type ReportScope } from "./mohome.ts";
import type { Channel, Material, ShopState, WasteReason, WasteReport, WasteStatus } from "./types.ts";
import { CHANNEL_LABEL } from "./types.ts";

/** Lý do nhân viên chọn khi báo hỏng. Không gồm hao hụt kiểm kho. */
export const WASTE_REASONS = [
  ["in_loi", "In lỗi"],
  ["lech_vien", "Lệch viền"],
  ["bong_mang", "Bong màng"],
  ["rach", "Rách"],
  ["roi_vo", "Rơi vỡ"],
  ["khac", "Khác"],
] as const;

export const WASTE_REASON_UNCLEAR = "chua_ro" as const satisfies WasteReason;

const REASON_LABEL: Record<WasteReason, string> = {
  in_loi: "In lỗi",
  lech_vien: "Lệch viền",
  bong_mang: "Bong màng",
  rach: "Rách",
  roi_vo: "Rơi vỡ",
  khac: "Khác",
  chua_ro: "Hao hụt chưa rõ lý do",
};

const STATUS_LABEL: Record<WasteStatus, string> = {
  pending: "Mới báo",
  confirmed: "Đã chốt",
  approved: "Đã duyệt",
  void: "Đã hủy",
};

/** Phiếu trừ hao hụt. Khác phiếu in / đóng gói nên hủy đơn không hoàn. */
export const WASTE_MOVE_REASON = "Hao hụt";
export const COUNT_MOVE_REASON = "Kiểm kho";

const USER_REASONS = new Set<string>(WASTE_REASONS.map((row) => row[0]));
const OPEN = new Set(["draft_upload", "upload_error"]);

export function wasteReasonLabel(reason: WasteReason): string {
  return REASON_LABEL[reason];
}

export function wasteStatusLabel(status: WasteStatus): string {
  return STATUS_LABEL[status];
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/** Giá một đơn vị đang trừ. Có quy cách thì chia giá lần mua. Không có giá thì null. */
export function unitCost(material: Pick<Material, "packPrice" | "packSize">): number | null {
  if (material.packPrice === null || !Number.isFinite(material.packPrice)) return null;
  if (material.packSize !== null && material.packSize > 0) return material.packPrice / material.packSize;
  return material.packPrice;
}

function readReports(state: { wasteReports?: WasteReport[] }): WasteReport[] {
  return state.wasteReports ?? [];
}

function reportsOf(state: ShopState): WasteReport[] {
  return state.wasteReports ?? (state.wasteReports = []);
}

function materialOf(state: ShopState, materialId: string): Material {
  const material = state.materials.find((item) => item.id === materialId);
  if (!material) throw new Error("Không thấy vật tư.");
  return material;
}

function positiveQty(qty: number): number {
  if (!Number.isFinite(qty) || qty <= 0) throw new Error("Số lượng phải lớn hơn 0.");
  const rounded = round4(qty);
  if (!(rounded > 0)) throw new Error("Số lượng phải lớn hơn 0.");
  return rounded;
}

export function wasteInScope(channel: Channel | undefined, scope: ReportScope): boolean {
  if (scope === "all") return true;
  if (!channel) return scope === "nha_in";
  return orderInScope(channel, scope);
}

function lineDong(state: ShopState, report: WasteReport): number | null {
  const material = (state.materials ?? []).find((item) => item.id === report.materialId);
  if (!material) return null;
  const unit = unitCost(material);
  if (unit === null) return null;
  return Math.round(report.qty * unit);
}

export type WasteSlice = { key: string; label: string; lines: number; qty: number; cost: number };

export type WasteMonth = {
  wasteCost: number;
  wasteUnknown: number;
  wasteLines: number;
  wasteRate: number | null;
  wasteAlert: boolean;
  wasteThreshold: number | null;
  placed: number;
  byDay: WasteSlice[];
  byMaterial: WasteSlice[];
  byReason: WasteSlice[];
  byPerson: WasteSlice[];
  byChannel: WasteSlice[];
};

function addSlice(map: Map<string, WasteSlice>, key: string, label: string, qty: number, cost: number) {
  const row = map.get(key) ?? { key, label, lines: 0, qty: 0, cost: 0 };
  row.lines += 1;
  row.qty = round4(row.qty + qty);
  row.cost += cost;
  map.set(key, row);
}

/** Hao hụt trong tháng, trừ phiếu đã hủy. Tiền chỉ cộng dòng đã có giá mua. */
export function wasteMonth(state: ShopState, month: string, scope: ReportScope, revenue: number): WasteMonth {
  const rows = readReports(state).filter((report) => report.status !== "void" && report.day.slice(0, 7) === month && wasteInScope(report.channel, scope));
  const byDay = new Map<string, WasteSlice>();
  const byMaterial = new Map<string, WasteSlice>();
  const byReason = new Map<string, WasteSlice>();
  const byPerson = new Map<string, WasteSlice>();
  const byChannel = new Map<string, WasteSlice>();
  let wasteCost = 0;
  let wasteUnknown = 0;
  for (const report of rows) {
    const dong = lineDong(state, report);
    const cost = dong ?? 0;
    if (dong === null) wasteUnknown += 1;
    else wasteCost += dong;
    const material = (state.materials ?? []).find((item) => item.id === report.materialId);
    const person = (state.staff ?? []).find((item) => item.id === report.by);
    addSlice(byDay, report.day, report.day, report.qty, cost);
    addSlice(byMaterial, report.materialId, material?.name ?? report.materialId, report.qty, cost);
    addSlice(byReason, report.reason, wasteReasonLabel(report.reason), report.qty, cost);
    addSlice(byPerson, report.by ?? "", person?.name ?? "Không rõ", report.qty, cost);
    addSlice(byChannel, report.channel ?? "", report.channel ? CHANNEL_LABEL[report.channel] : "Không thuộc kênh", report.qty, cost);
  }
  const placed = (state.orders ?? []).filter(
    (order) => !order.isTest && !OPEN.has(order.status) && vnMonth(order.createdAt) === month && orderInScope(order.channel, scope),
  ).length;
  const threshold = state.settings.wasteAlertPercent ?? null;
  const wasteRate = revenue > 0 ? Math.round((wasteCost / revenue) * 1000) / 10 : null;
  const sortCost = (rows: WasteSlice[]) => rows.sort((a, b) => b.cost - a.cost || b.lines - a.lines || a.label.localeCompare(b.label, "vi"));
  return {
    wasteCost,
    wasteUnknown,
    wasteLines: rows.length,
    wasteRate,
    wasteAlert: wasteRate !== null && threshold !== null && wasteRate > threshold,
    wasteThreshold: threshold,
    placed,
    byDay: [...byDay.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byMaterial: sortCost([...byMaterial.values()]),
    byReason: sortCost([...byReason.values()]),
    byPerson: sortCost([...byPerson.values()]),
    byChannel: sortCost([...byChannel.values()]),
  };
}

export type RecordWasteInput = {
  materialId: string;
  qty: number;
  reason: Exclude<WasteReason, "chua_ro">;
  orderId?: string | null;
  by: string | null;
  note?: string;
  photoId?: string | null;
  at: string;
  id: () => string;
};

/** Trừ kho một lần và ghi phiếu hao hụt đang chờ. */
export function recordWaste(state: ShopState, input: RecordWasteInput): WasteReport {
  if (!USER_REASONS.has(input.reason)) throw new Error("Chọn lý do hỏng.");
  const qty = positiveQty(input.qty);
  const material = materialOf(state, input.materialId);
  const order = input.orderId ? state.orders.find((item) => item.id === input.orderId) : null;
  if (input.orderId && !order) throw new Error("Không thấy đơn.");
  const id = input.id();
  const movementId = input.id();
  const reasonLabel = wasteReasonLabel(input.reason);
  material.stock = round4(material.stock - qty);
  state.movements.unshift({
    id: movementId,
    at: input.at,
    materialId: material.id,
    qty: -qty,
    reason: WASTE_MOVE_REASON,
    orderId: order?.id ?? null,
    by: input.by,
    note: order ? `${order.code} · ${reasonLabel}` : reasonLabel,
    ...(order ? { channel: order.channel } : {}),
    wasteId: id,
  });
  const report: WasteReport = {
    id,
    at: input.at,
    day: vnYmd(input.at),
    materialId: material.id,
    qty,
    reason: input.reason,
    orderId: order?.id ?? null,
    ...(order ? { channel: order.channel } : {}),
    by: input.by,
    note: (input.note ?? "").trim(),
    photoId: input.photoId ?? null,
    movementId,
    status: "pending",
  };
  reportsOf(state).unshift(report);
  return report;
}

export type EditWasteInput = {
  id: string;
  qty: number;
  reason: WasteReason;
  materialId: string;
  note: string;
};

/** Sửa số lượng trên đúng phiếu trừ. Kho chỉ xê dịch phần chênh. */
export function editWaste(state: ShopState, input: EditWasteInput): void {
  const report = reportsOf(state).find((item) => item.id === input.id);
  if (!report) throw new Error("Không thấy phiếu hỏng.");
  if (report.status === "void") throw new Error("Phiếu đã hủy.");
  if (!REASON_LABEL[input.reason]) throw new Error("Chọn lý do hỏng.");
  const qty = positiveQty(input.qty);
  const movement = state.movements.find((item) => item.id === report.movementId);
  if (input.materialId !== report.materialId) {
    const previous = materialOf(state, report.materialId);
    const next = materialOf(state, input.materialId);
    previous.stock = round4(previous.stock + report.qty);
    next.stock = round4(next.stock - qty);
    report.materialId = next.id;
    if (movement) movement.materialId = next.id;
  } else if (qty !== report.qty) {
    const material = materialOf(state, report.materialId);
    material.stock = round4(material.stock + report.qty - qty);
  }
  report.qty = qty;
  report.reason = input.reason;
  report.note = input.note.trim();
  if (movement) {
    movement.qty = -qty;
    movement.note = movement.note.includes("·") ? movement.note.replace(/[^·]+$/, ` ${wasteReasonLabel(input.reason)}`) : wasteReasonLabel(input.reason);
  }
}

/** Hủy phiếu một lần: trả kho đúng số đang ghi, đưa phiếu trừ về 0. */
export function voidWaste(state: ShopState, id: string): void {
  const report = reportsOf(state).find((item) => item.id === id);
  if (!report) throw new Error("Không thấy phiếu hỏng.");
  if (report.status === "void") return;
  const material = materialOf(state, report.materialId);
  material.stock = round4(material.stock + report.qty);
  const movement = state.movements.find((item) => item.id === report.movementId);
  if (movement) movement.qty = 0;
  report.status = "void";
}

/** Sản xuất chốt danh sách trong ngày. Không trừ kho thêm. */
export function confirmWasteDay(state: ShopState, day: string, by: string | null, at: string): number {
  let count = 0;
  for (const report of reportsOf(state)) {
    if (report.day !== day || report.status !== "pending") continue;
    report.status = "confirmed";
    report.confirmedAt = at;
    report.confirmedBy = by;
    count += 1;
  }
  return count;
}

/** Chủ duyệt. Gọi lại không đổi kho. */
export function approveWaste(state: ShopState, id: string, by: string | null, at: string): void {
  const report = reportsOf(state).find((item) => item.id === id);
  if (!report) throw new Error("Không thấy phiếu hỏng.");
  if (report.status === "void") throw new Error("Phiếu đã hủy.");
  if (report.status === "approved") return;
  report.status = "approved";
  report.approvedAt = at;
  report.approvedBy = by;
}

export type CountStockInput = {
  materialId: string;
  actual: number;
  note: string;
  by: string | null;
  at: string;
  id: () => string;
};

/**
 * Kiểm kho so với sổ.
 * Khớp: chỉ ghi lần đếm.
 * Thừa: một phiếu Kiểm kho.
 * Thiếu: một phiếu Hao hụt, lý do chưa rõ. Không ghi thêm phiếu Kiểm kho.
 */
export function applyStockCount(state: ShopState, input: CountStockInput): void {
  if (!Number.isFinite(input.actual) || input.actual < 0) throw new Error("Số đếm không hợp lệ.");
  const material = materialOf(state, input.materialId);
  const systemQty = material.stock;
  const actual = round4(input.actual);
  const delta = round4(actual - round4(systemQty));
  material.openingCounted = true;
  material.stock = actual;
  state.counts.unshift({
    id: input.id(),
    at: input.at,
    materialId: material.id,
    systemQty,
    actualQty: actual,
    by: input.by,
    note: input.note.trim(),
  });
  if (delta === 0) return;
  if (delta > 0) {
    state.movements.unshift({
      id: input.id(),
      at: input.at,
      materialId: material.id,
      qty: delta,
      reason: COUNT_MOVE_REASON,
      orderId: null,
      by: input.by,
      note: input.note.trim(),
    });
    return;
  }
  const id = input.id();
  const movementId = input.id();
  const qty = round4(-delta);
  state.movements.unshift({
    id: movementId,
    at: input.at,
    materialId: material.id,
    qty: delta,
    reason: WASTE_MOVE_REASON,
    orderId: null,
    by: input.by,
    note: input.note.trim() || wasteReasonLabel(WASTE_REASON_UNCLEAR),
    wasteId: id,
  });
  reportsOf(state).unshift({
    id,
    at: input.at,
    day: vnYmd(input.at),
    materialId: material.id,
    qty,
    reason: WASTE_REASON_UNCLEAR,
    orderId: null,
    by: input.by,
    note: input.note.trim(),
    photoId: null,
    movementId,
    status: "pending",
  });
}

export type WasteRow = {
  id: string;
  at: string;
  day: string;
  materialId: string;
  materialName: string;
  unit: string;
  qty: number;
  reason: WasteReason;
  reasonLabel: string;
  orderId: string | null;
  orderCode: string;
  channelLabel: string;
  byName: string;
  note: string;
  status: WasteStatus;
  statusLabel: string;
  photoId: string | null;
  cost: number | null;
};

function rowOf(state: ShopState, report: WasteReport, showCost: boolean): WasteRow {
  const material = state.materials.find((item) => item.id === report.materialId);
  const order = report.orderId ? state.orders.find((item) => item.id === report.orderId) : null;
  const person = state.staff.find((item) => item.id === report.by);
  const cost = lineDong(state, report);
  return {
    id: report.id,
    at: report.at,
    day: report.day,
    materialId: report.materialId,
    materialName: material?.name ?? report.materialId,
    unit: material?.unit ?? "",
    qty: report.qty,
    reason: report.reason,
    reasonLabel: wasteReasonLabel(report.reason),
    orderId: report.orderId,
    orderCode: order?.code ?? "",
    channelLabel: report.channel ? CHANNEL_LABEL[report.channel] : "Không thuộc kênh",
    byName: person?.name ?? "",
    note: report.note,
    status: report.status,
    statusLabel: wasteStatusLabel(report.status),
    photoId: report.photoId,
    cost: showCost ? cost : null,
  };
}

export function wasteDesk(state: ShopState, role: "owner" | "sale" | "production") {
  const day = vnYmd();
  const month = day.slice(0, 7);
  const showCost = role === "owner";
  const done = state.orders.filter((order) => order.status === "xong" && !order.isTest && vnMonth(order.completedAt || order.updatedAt || order.createdAt) === month);
  const revenue = done.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const rawSummary = wasteMonth(state, month, "all", revenue);
  const summary = showCost ? rawSummary : blankMoney(rawSummary);
  const rows = readReports(state)
    .filter((report) => report.status !== "void")
    .map((report) => rowOf(state, report, showCost))
    .sort((a, b) => Number(a.status === "approved") - Number(b.status === "approved") || b.at.localeCompare(a.at));
  return {
    day,
    month,
    role,
    showCost,
    canClose: role === "owner" || role === "production",
    canApprove: role === "owner",
    pending: rows.filter((row) => row.status === "pending" || row.status === "confirmed").length,
    rows,
    summary,
    materials: [...state.materials]
      .sort((a, b) => a.name.localeCompare(b.name, "vi"))
      .map((material) => ({ id: material.id, name: material.name, unit: material.unit, stock: material.stock })),
    orders: state.orders
      .filter((order) => !OPEN.has(order.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 40)
      .map((order) => ({
        id: order.id,
        code: order.code,
        channelLabel: CHANNEL_LABEL[order.channel],
        customerName: state.customers.find((customer) => customer.id === order.customerId)?.name ?? "",
      })),
    reasons: WASTE_REASONS.map(([id, label]) => ({ id, label })),
  };
}

function blankMoney(summary: WasteMonth): WasteMonth {
  const hide = (rows: WasteSlice[]) => rows.map((row) => ({ ...row, cost: 0 }));
  return {
    ...summary,
    wasteCost: 0,
    wasteRate: null,
    wasteAlert: false,
    wasteThreshold: null,
    byDay: hide(summary.byDay),
    byMaterial: hide(summary.byMaterial),
    byReason: hide(summary.byReason),
    byPerson: hide(summary.byPerson),
    byChannel: hide(summary.byChannel),
  };
}

export function ensureWaste(state: { wasteReports?: WasteReport[]; settings: { wasteAlertPercent?: number | null } }): boolean {
  let changed = false;
  if (!state.wasteReports) {
    state.wasteReports = [];
    changed = true;
  }
  if (state.settings.wasteAlertPercent === undefined) {
    state.settings.wasteAlertPercent = null;
    changed = true;
  }
  return changed;
}
