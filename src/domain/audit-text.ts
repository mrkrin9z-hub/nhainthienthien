import { vnParts, vnYmd } from "./calc.ts";
import type { Audit, Channel, OrderStatus, Role } from "./types.ts";
import { CHANNEL_LABEL, PRICE_STATUS_LABEL, ROLE_LABEL, STATUS_LABEL } from "./types.ts";

export const AUDIT_ACTIONS: { action: string; label: string }[] = [
  { action: "auth.login", label: "Đăng nhập" },
  { action: "auth.lock", label: "Khóa đăng nhập" },
  { action: "auth.fail", label: "Đăng nhập sai" },
  { action: "auth.totp", label: "Mã xác thực" },
  { action: "staff.password", label: "Đổi mật khẩu" },
  { action: "staff.update", label: "Tài khoản" },
  { action: "order.create", label: "Tạo đơn" },
  { action: "order.status", label: "Chuyển bước" },
  { action: "order.deposit", label: "Cọc" },
  { action: "order.import", label: "Nhập đơn sàn" },
  { action: "order.shipping", label: "Giao hàng" },
  { action: "order.cod", label: "COD" },
  { action: "price.update", label: "Đổi giá" },
  { action: "sku.pieces", label: "Số miếng" },
  { action: "sku.map", label: "Map SKU" },
  { action: "stock.in", label: "Nhập kho" },
  { action: "stock.count", label: "Kiểm kho" },
  { action: "stock.ink", label: "Mở mực" },
  { action: "material.price", label: "Giá vật tư" },
  { action: "material.update", label: "Vật tư" },
  { action: "bom.update", label: "Định mức" },
  { action: "customer.update", label: "Khách" },
  { action: "punch.edit", label: "Sửa giờ công" },
  { action: "cost.fixed", label: "Chi phí cố định" },
  { action: "settings.update", label: "Cài đặt" },
  { action: "file.delete", label: "Xóa file" },
  { action: "backup.manual", label: "Sao lưu" },
  { action: "backup.restore", label: "Khôi phục" },
  { action: "secret.update", label: "Khóa kết nối" },
  { action: "photo.product", label: "Ảnh sản phẩm" },
];

const SETTING_LABEL: Record<string, string> = {
  inkPercent: "Mực (% giá bán)",
  tiktokFeePercent: "TikTok phí %",
  tiktokExtraPercent: "TikTok phí thêm %",
  tiktokFixed: "TikTok phí/đơn",
  tiktokTaxPercent: "TikTok thuế %",
  tiktokCommissionPercent: "TikTok hoa hồng sale %",
  tiktokAffiliatePercent: "TikTok affiliate %",
  shopeeFeePercent: "Shopee phí %",
  shopeeExtraPercent: "Shopee phí thêm %",
  shopeeInfra: "Shopee hạ tầng",
  shopeePiship: "Shopee PiShip",
  shopeeTaxPercent: "Shopee thuế %",
  shopeeCommissionPercent: "Shopee hoa hồng %",
  shopeeAffiliatePercent: "Shopee affiliate %",
  fbTaxPercent: "Facebook thuế %",
  fbCommissionPercent: "Facebook hoa hồng %",
  fbAdsPercent: "Facebook quảng cáo %",
  fbCodPercent: "Facebook phí COD %",
  fbShipping: "Phí ship Facebook",
  walkinCommissionPercent: "Tại tiệm hoa hồng %",
  marginYellowPercent: "Ngưỡng vàng lãi gộp (%)",
  marginRedPercent: "Ngưỡng đỏ",
  wasteRate: "Hao hụt",
  tapeOrdersPerRoll: "Số đơn / cuộn băng keo",
  magnetPiecesPerSheet: "Miếng nam châm / tấm",
  ppRollWidthCm: "Khổ cuộn PP (cm)",
  filmRollWidthCm: "Khổ cuộn màng (cm)",
  foamRollWidthCm: "Khổ cuộn xốp (cm)",
  foamRollLengthM: "Dài cuộn xốp (m)",
  depositMinTotal: "Đơn Facebook phải cọc từ",
  depositPercent: "% cọc",
  breakevenMonth: "Doanh thu hòa vốn tháng",
  breakevenDay: "Doanh thu hòa vốn ngày",
  workStart: "Giờ vào ca",
  workEnd: "Giờ ra ca",
  weeklyOff: "Ngày nghỉ trong tuần",
  lateGraceMinutes: "Ân hạn đi trễ (phút)",
  lateDeductionPerMinute: "Trừ mỗi phút đi trễ",
  absenceDeductionPerDay: "Trừ mỗi ngày vắng",
  saleBase: "Lương cứng sale",
  saleProbationPercent: "Thử việc sale %",
  productionBase: "Lương sản xuất",
  kpiTargets: "Mốc KPI",
  commissionTiers: "Bậc hoa hồng",
  commissionBasis: "Cách tính hoa hồng",
  shopOpenDate: "Ngày mở cửa",
  fileRetentionDays: "Giữ ảnh khách (ngày)",
  videoRetentionDays: "Giữ video đóng gói (ngày)",
  zaloPhone: "Số Zalo",
  showZalo: "Hiện Zalo trên web",
  publicHours: "Giờ mở cửa trên web",
  showAnhThe: "Hiện ảnh thẻ",
  showAlbum: "Hiện album",
  groupListed: "Nhóm hiện trên web",
  productPhotos: "Ảnh sản phẩm",
  marketplaceCutoff: "Mốc nhận đơn sàn",
  marketplaceHandover: "Mốc bàn giao sàn",
  repeatCustomerOrders: "Khách quay lại từ số đơn",
  remindAfterDays: "Nhắc khi đơn cuối cách đây (ngày)",
  remindMessage: "Mẫu tin nhắc khách",
  fixedCosts: "Chi phí cố định mặc định",
  rentFromJune2027: "Mặt bằng từ T6/2027",
};

const MONEY_KEYS = new Set([
  "tiktokFixed",
  "shopeeInfra",
  "shopeePiship",
  "fbShipping",
  "depositMinTotal",
  "breakevenMonth",
  "breakevenDay",
  "lateDeductionPerMinute",
  "absenceDeductionPerDay",
  "saleBase",
  "productionBase",
  "rentFromJune2027",
]);

const SECRET_LABEL: Record<string, string> = {
  tiktok: "TikTok Shop",
  shopee: "Shopee",
  meta: "Meta / Facebook",
  zalo: "Zalo OA",
  carrier: "Đơn vị vận chuyển",
};

const WEEKDAY = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

export type AuditShop = {
  staff: { id: string; name: string; role: Role }[];
  orders: { id: string; code: string }[];
  materials: { id: string; name: string; unit: string }[];
  skus: { id: string; code: string }[];
  customers: { id: string; name: string }[];
  groups: { id: string; slug: string; name: string }[];
  boms: { id: string; skuId: string; materialId: string }[];
  punches: { id: string; staffId: string }[];
  fixedCosts: { key: string; name: string }[];
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTIONS.find((item) => item.action === action)?.label ?? "Việc khác";
}

export function auditDay(at: string): string {
  return vnYmd(at);
}

export function describeAudit(item: Pick<Audit, "action" | "entity" | "actorId" | "before" | "after">, shop: AuditShop): string {
  const actor = who(item.actorId, shop);
  const detail = detailOf(item, shop, actor);
  return detail.startsWith(actor) ? detail : `${actor} ${detail}`;
}

function who(actorId: string | null, shop: AuditShop): string {
  if (!actorId) return "Hệ thống";
  const person = shop.staff.find((item) => item.id === actorId);
  if (!person) return "Người đã nghỉ";
  const role = ROLE_LABEL[person.role];
  if (person.name.toLocaleLowerCase("vi").includes(role.toLocaleLowerCase("vi"))) return person.name;
  return `${role} ${person.name}`;
}

function personLabel(id: string, shop: AuditShop): string {
  return who(id, shop);
}

function detailOf(item: Pick<Audit, "action" | "entity" | "before" | "after">, shop: AuditShop, actor: string): string {
  const before = rec(item.before);
  const after = rec(item.after);
  switch (item.action) {
    case "order.status":
      return statusSentence(actor, orderCode(shop, item.entity), before, after);
    case "order.create":
      return `tạo đơn ${text(after?.code) || orderCode(shop, item.entity)}${channelBit(after?.channel)}`;
    case "order.import":
      return `nhập đơn sàn ${text(after?.code) || orderCode(shop, item.entity)}${after?.platform ? ` mã ${text(after.platform)}` : ""}${channelBit(after?.channel)}`;
    case "order.deposit":
      return `ghi cọc đơn ${orderCode(shop, item.entity)}: ${dong(before?.depositPaid)} → ${dong(after?.depositPaid)}${after?.method ? ` (${text(after.method)})` : ""}`;
    case "order.shipping":
      return `sửa giao hàng đơn ${orderCode(shop, item.entity)}: ${shippingBits(before, after)}`;
    case "order.cod":
      return `${after?.received ? "đánh dấu đã nhận COD" : "bỏ đánh dấu COD"} đơn ${orderCode(shop, item.entity)}`;
    case "price.update":
      return `đổi giá ${priceSentence(item.entity, before, after)}`;
    case "sku.pieces":
      return `đặt số miếng mỗi tấm ${skuCode(shop, item.entity)} thành ${after?.pieces == null ? "chưa có" : text(after.pieces)}`;
    case "sku.map":
      return `gắn SKU sàn ${item.entity} với ${skuCode(shop, text(after?.skuId))}${channelBit(after?.channel)}`;
    case "stock.in":
      return `nhập kho ${materialBit(shop, item.entity, num(after?.qty), true)}${after?.packPrice != null ? ` · giá gói ${dong(after.packPrice)}` : ""}`;
    case "stock.count":
      return `kiểm kho ${materialName(shop, item.entity)}: ${qty(num(before?.stock), unitOf(shop, item.entity))} → ${qty(num(after?.stock), unitOf(shop, item.entity))}`;
    case "stock.ink":
      return "mở một lọ mực";
    case "material.price":
      return `duyệt giá mua ${materialName(shop, item.entity)}: ${dong(before?.packPrice)} → ${dong(after?.packPrice)}`;
    case "material.update":
      return `sửa vật tư ${materialName(shop, item.entity)}: ${materialBits(before, after)}`;
    case "bom.update":
      return `sửa định mức ${bomLabel(shop, item.entity)}: ${qty(num(before?.qty))} → ${after?.qty == null ? "chưa có" : qty(num(after.qty))}`;
    case "customer.update":
      return `sửa hồ sơ khách ${customerName(shop, item.entity)}${tagsBit(after?.tags)}`;
    case "punch.edit":
      return `sửa giờ công của ${personLabel(punchStaff(shop, item.entity), shop)}: vào ${hm(before?.inAt)} → ${hm(after?.inAt)}, ra ${hm(before?.outAt)} → ${hm(after?.outAt)}`;
    case "cost.fixed":
      return `sửa chi phí cố định ${costLabel(shop, item.entity)}: ${dong(before?.amount)} → ${dong(after?.amount)}`;
    case "settings.update":
      return `sửa cài đặt: ${settingsBits(item.before, item.after, shop)}`;
    case "staff.update":
      return `cập nhật tài khoản ${personLabel(item.entity, shop)}${after?.email ? ` · ${text(after.email)}` : ""}`;
    case "staff.password":
      return "đổi mật khẩu";
    case "auth.login":
      return "đăng nhập";
    case "auth.lock":
      return lockSentence(item.entity, after);
    case "auth.fail":
      return `ghi một lần đăng nhập sai của ${item.entity}`;
    case "auth.totp":
      return after?.enabled ? "bật mã xác thực 6 số" : "tắt mã xác thực 6 số";
    case "file.delete":
      return `xóa file ${text(before?.name) || "ảnh"}`;
    case "backup.manual":
      return "sao lưu ngay";
    case "backup.restore":
      return `khôi phục sổ từ bản ${item.entity} (giữ tài khoản)`;
    case "secret.update":
      return `${after?.set === false ? "xóa" : "lưu"} khóa kết nối ${SECRET_LABEL[item.entity] ?? "kênh ngoài"}`;
    case "photo.product":
      return `${after?.cleared ? "xóa ảnh sản phẩm" : "đổi ảnh sản phẩm"} ${groupName(shop, item.entity)}`;
    default:
      return `ghi việc ${auditActionLabel(item.action)}`;
  }
}

function statusSentence(actor: string, code: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  const from = statusName(before?.status);
  const to = statusName(after?.status);
  const reopening = (before?.status === "huy" || before?.status === "xong") && before?.status !== after?.status;
  if (reopening) {
    const reason = text(after?.reason);
    return `${actor} mở lại đơn ${code}: ${from} → ${to}${reason ? ` (lý do: ${reason})` : ""}`;
  }
  if (before?.status === after?.status) return `${actor} ghi lại đơn ${code} ở bước ${to}`;
  return `${actor} chuyển đơn ${code}: ${from} → ${to}`;
}

function priceSentence(entity: string, before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  const cut = entity.lastIndexOf(":");
  const code = cut > 0 ? entity.slice(0, cut) : entity;
  const channel = cut > 0 ? entity.slice(cut + 1) : text(after?.channel);
  const statusBit =
    before?.status && after?.status && before.status !== after.status
      ? ` · ${priceStatus(before.status)} → ${priceStatus(after.status)}`
      : "";
  return `${code} kênh ${channelLabel(channel)}: ${dong(before?.price ?? null)} → ${dong(after?.price ?? null)}${statusBit}`;
}

function shippingBits(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  const bits: string[] = [];
  if (text(before?.carrier) !== text(after?.carrier)) bits.push(`hãng ${text(before?.carrier) || "chưa ghi"} → ${text(after?.carrier) || "chưa ghi"}`);
  if (text(before?.tracking) !== text(after?.tracking)) bits.push(`vận đơn ${text(before?.tracking) || "chưa có"} → ${text(after?.tracking) || "chưa có"}`);
  if (num(before?.shipFee) !== num(after?.shipFee)) bits.push(`phí ship ${dong(before?.shipFee)} → ${dong(after?.shipFee)}`);
  if (num(before?.codAmount) !== num(after?.codAmount)) bits.push(`COD ${dong(before?.codAmount)} → ${dong(after?.codAmount)}`);
  return bits.length ? bits.join(", ") : "không đổi số giao hàng";
}

function materialBits(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string {
  const bits: string[] = [];
  if (num(before?.packPrice) !== num(after?.packPrice)) bits.push(`giá gói ${dong(before?.packPrice)} → ${dong(after?.packPrice)}`);
  if (num(before?.packSize) !== num(after?.packSize)) bits.push(`quy cách ${plain(before?.packSize)} → ${plain(after?.packSize)}`);
  if (num(before?.minStock) !== num(after?.minStock)) bits.push(`tồn tối thiểu ${plain(before?.minStock)} → ${plain(after?.minStock)}`);
  if (num(before?.leadTimeDays) !== num(after?.leadTimeDays)) bits.push(`ngày chờ hàng ${plain(before?.leadTimeDays)} → ${plain(after?.leadTimeDays)}`);
  return bits.length ? bits.join(", ") : "cập nhật thông tin";
}

function settingsBits(before: unknown, after: unknown, shop: AuditShop): string {
  const oldRow = rec(before) ?? {};
  const next = rec(after) ?? {};
  const bits: string[] = [];
  const keys = new Set([...Object.keys(oldRow), ...Object.keys(next)]);
  for (const key of keys) {
    if (stable(oldRow[key]) === stable(next[key])) continue;
    if (key === "groupListed") {
      bits.push(...groupBits(oldRow[key], next[key], shop));
      continue;
    }
    if (key === "fixedCosts" || key === "commissionTiers" || key === "kpiTargets" || key === "productPhotos" || key === "remindMessage") {
      bits.push(`sửa ${SETTING_LABEL[key] ?? key}`);
      continue;
    }
    bits.push(`${SETTING_LABEL[key] ?? key} ${settingValue(key, oldRow[key])} → ${settingValue(key, next[key])}`);
  }
  if (!bits.length) return "không đổi số nào";
  if (bits.length <= 4) return bits.join(", ");
  return `${bits.slice(0, 3).join(", ")}, và ${bits.length - 3} mục nữa`;
}

function groupBits(before: unknown, after: unknown, shop: AuditShop): string[] {
  const oldRow = rec(before) ?? {};
  const next = rec(after) ?? {};
  const bits: string[] = [];
  for (const key of new Set([...Object.keys(oldRow), ...Object.keys(next)])) {
    if (oldRow[key] === next[key]) continue;
    const name = shop.groups.find((group) => group.id === key)?.name ?? key;
    bits.push(`${next[key] === false ? "ẩn" : "hiện"} nhóm ${name}`);
  }
  return bits.length ? bits : ["sửa nhóm hiện trên web"];
}

function settingValue(key: string, value: unknown): string {
  if (value == null || value === "") return "chưa có";
  if (key === "commissionBasis") return value === "handled" ? "Theo đơn người đó xử lý" : "Toàn tiệm";
  if (typeof value === "boolean") return value ? "bật" : "tắt";
  if (key === "weeklyOff" && Array.isArray(value)) {
    return value.length ? value.map((day) => WEEKDAY[Number(day)] ?? String(day)).join(", ") : "làm cả tuần";
  }
  if (MONEY_KEYS.has(key) && typeof value === "number") return dong(value);
  if (typeof value === "number") return qty(value);
  if (typeof value === "string") return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  return "đã sửa";
}

function lockSentence(email: string, after: Record<string, unknown> | null): string {
  const scope = text(after?.scope);
  const ip = text(after?.ip);
  if (scope === "ip") return `khóa IP ${ip || "không rõ"} sau nhiều lần đăng nhập sai`;
  if (scope === "both") return `khóa đăng nhập ${email} và IP ${ip || "không rõ"} sau nhiều lần sai`;
  return `khóa đăng nhập ${email} sau nhiều lần sai${ip ? ` (IP ${ip})` : ""}`;
}

function materialBit(shop: AuditShop, id: string, amount: number | null, signed: boolean): string {
  const unit = unitOf(shop, id);
  const shown = amount == null ? "không rõ" : `${signed && amount > 0 ? "+" : ""}${qty(amount, unit)}`;
  return `${materialName(shop, id)} ${shown}`;
}

function bomLabel(shop: AuditShop, id: string): string {
  const bom = shop.boms.find((item) => item.id === id);
  if (!bom) return id;
  return `${skuCode(shop, bom.skuId)} · ${materialName(shop, bom.materialId)}`;
}

function costLabel(shop: AuditShop, entity: string): string {
  const cut = entity.indexOf(":");
  const month = cut > 0 ? entity.slice(0, cut) : entity;
  const key = cut > 0 ? entity.slice(cut + 1) : "";
  const name = shop.fixedCosts.find((row) => row.key === key)?.name ?? key;
  const [year, mon] = month.split("-");
  const when = year && mon ? `tháng ${Number(mon)}/${year}` : month;
  return `${when}${name ? ` · ${name}` : ""}`;
}

function orderCode(shop: AuditShop, id: string): string {
  return shop.orders.find((order) => order.id === id)?.code ?? id;
}

function materialName(shop: AuditShop, id: string): string {
  return shop.materials.find((item) => item.id === id)?.name ?? id;
}

function unitOf(shop: AuditShop, id: string): string {
  return shop.materials.find((item) => item.id === id)?.unit ?? "";
}

function skuCode(shop: AuditShop, id: string): string {
  return shop.skus.find((sku) => sku.id === id)?.code ?? id;
}

function customerName(shop: AuditShop, id: string): string {
  return shop.customers.find((customer) => customer.id === id)?.name ?? "không rõ";
}

function groupName(shop: AuditShop, slug: string): string {
  return shop.groups.find((group) => group.slug === slug)?.name ?? slug;
}

function punchStaff(shop: AuditShop, id: string): string {
  return shop.punches.find((punch) => punch.id === id)?.staffId ?? "";
}

function channelBit(value: unknown): string {
  const label = channelLabel(value);
  return label ? ` (${label})` : "";
}

function channelLabel(value: unknown): string {
  if (typeof value === "string" && value in CHANNEL_LABEL) return CHANNEL_LABEL[value as Channel];
  return "";
}

function statusName(value: unknown): string {
  if (typeof value === "string" && value in STATUS_LABEL) return STATUS_LABEL[value as OrderStatus];
  return "không rõ";
}

function priceStatus(value: unknown): string {
  if (typeof value === "string" && value in PRICE_STATUS_LABEL) return PRICE_STATUS_LABEL[value as keyof typeof PRICE_STATUS_LABEL];
  return text(value);
}

function tagsBit(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "";
  return ` · thẻ ${value.map((tag) => text(tag)).filter(Boolean).join(", ")}`;
}

function hm(value: unknown): string {
  if (typeof value !== "string" || !value) return "chưa có";
  return vnParts(value).hm || "chưa có";
}

function dong(value: unknown): string {
  if (value == null || value === "") return "chưa có";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "chưa có";
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(amount))}đ`;
}

function qty(value: number, unit = ""): string {
  const shown = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(value);
  return unit ? `${shown} ${unit}` : shown;
}

function plain(value: unknown): string {
  if (value == null || value === "") return "chưa có";
  if (typeof value === "number") return qty(value);
  return text(value);
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function rec(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stable(value: unknown): string {
  return JSON.stringify(value ?? null);
}
