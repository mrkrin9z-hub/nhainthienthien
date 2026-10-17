import type {
  BomLine,
  Channel,
  ChannelPrice,
  Material,
  Order,
  OrderStatus,
  Settings,
  Sku,
} from "./types.ts";

export const STANDARD_SIZES = [
  { code: "13x18", w: 13, h: 18 },
  { code: "15x21", w: 15, h: 21 },
  { code: "20x30", w: 20, h: 30 },
  { code: "30x45", w: 30, h: 45 },
  { code: "40x60", w: 40, h: 60 },
  { code: "50x75", w: 50, h: 75 },
  { code: "60x90", w: 60, h: 90 },
] as const;

export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function money(n: number): number {
  return Math.round(n);
}

/** Mét dài cuộn cho 1 ảnh: xếp vừa khổ cuộn, lấy cách ít hao chiều dài nhất, cộng hao hụt. */
export function rollMeters(
  widthCm: number,
  heightCm: number,
  rollWidthCm: number,
  wasteRate: number,
): number | null {
  const candidates: number[] = [];
  const consider = (acrossCm: number, alongCm: number) => {
    if (acrossCm <= 0 || alongCm <= 0 || acrossCm > rollWidthCm) return;
    const count = Math.floor(rollWidthCm / acrossCm);
    if (count < 1) return;
    candidates.push(alongCm / count);
  };
  consider(widthCm, heightCm);
  consider(heightCm, widthCm);
  if (!candidates.length) return null;
  return round4((Math.min(...candidates) / 100) * (1 + wasteRate));
}

export function edgeMeters(widthCm: number, heightCm: number): number {
  return round4((2 * (widthCm + heightCm)) / 100);
}

/** 2 mặt × (rộng + 10cm) × (cao + 10cm), đơn vị m². */
export function wrapM2(widthCm: number, heightCm: number): number {
  return round4((2 * (widthCm + 10) * (heightCm + 10)) / 10000);
}

export function isDeskSize(size: string | null): boolean {
  return size === "13x18" || size === "15x21" || size === "20x30";
}

export function isWallSize(size: string | null): boolean {
  return size === "30x45" || size === "40x60" || size === "50x75" || size === "60x90";
}

export function needsLargeDeposit(size: string | null): boolean {
  return size === "40x60" || size === "50x75" || size === "60x90";
}

export function materialUnitCost(material: Material): number | null {
  if (material.packPrice === null || material.packSize === null || material.packSize === 0) return null;
  return material.packPrice / material.packSize;
}

export type CostLine = { name: string; amount: number | null; detail: string };

export function bomQuantity(line: BomLine, sheets: number): number | null {
  if (line.qty === null) return null;
  return line.scope === "sheet" ? line.qty * sheets : line.qty;
}

export function materialCost(
  sku: Sku,
  boms: BomLine[],
  materials: Material[],
): { lines: CostLine[]; total: number | null; incomplete: boolean } {
  const lines: CostLine[] = [];
  let total = 0;
  let incomplete = false;
  for (const bom of boms.filter((b) => b.skuId === sku.id)) {
    const material = materials.find((m) => m.id === bom.materialId);
    const qty = bomQuantity(bom, sku.sheets);
    if (!material || qty === null) {
      incomplete = true;
      lines.push({
        name: material?.name ?? bom.materialId,
        amount: null,
        detail: "Chưa có định mức",
      });
      continue;
    }
    const unit = materialUnitCost(material);
    if (unit === null) {
      incomplete = true;
      lines.push({
        name: material.name,
        amount: null,
        detail: `${qty} ${material.unit} — chưa có đơn giá`,
      });
      continue;
    }
    const amount = qty * unit;
    total += amount;
    lines.push({
      name: material.name,
      amount,
      detail: `${qty} ${material.unit}`,
    });
  }
  return { lines, total: incomplete ? null : money(total), incomplete };
}

export function feeLines(
  channel: Channel,
  price: number,
  settings: Settings,
  affiliate: boolean,
): CostLine[] {
  const pct = (name: string, percent: number): CostLine => ({
    name,
    amount: (price * percent) / 100,
    detail: `${percent}%`,
  });
  const fixed = (name: string, amount: number | null): CostLine => ({
    name,
    amount,
    detail: amount === null ? "Chưa có số" : "khoản cố định",
  });
  if (channel === "tiktok") {
    const lines = [
      pct("Phí TikTok", settings.tiktokFeePercent + settings.tiktokExtraPercent),
      fixed("Phí đơn TikTok", settings.tiktokFixed),
      pct("Thuế", settings.tiktokTaxPercent),
      pct("Hoa hồng sale", settings.tiktokCommissionPercent),
    ];
    if (affiliate) lines.push(pct("Affiliate", settings.tiktokAffiliatePercent));
    return lines;
  }
  if (channel === "shopee") {
    const lines = [
      pct("Phí Shopee", settings.shopeeFeePercent + settings.shopeeExtraPercent),
      fixed("Phí hạ tầng", settings.shopeeInfra),
      fixed("PiShip", settings.shopeePiship),
      pct("Thuế", settings.shopeeTaxPercent),
      pct("Hoa hồng sale", settings.shopeeCommissionPercent),
    ];
    if (affiliate) lines.push(pct("Affiliate", settings.shopeeAffiliatePercent));
    return lines;
  }
  if (channel === "facebook") {
    return [
      pct("Thuế", settings.fbTaxPercent),
      pct("Hoa hồng sale", settings.fbCommissionPercent),
      pct("Quảng cáo", settings.fbAdsPercent),
      pct("Phí thu hộ COD", settings.fbCodPercent),
      fixed("Phí ship Facebook", settings.fbShipping),
    ];
  }
  return [pct("Hoa hồng sale", settings.walkinCommissionPercent)];
}

export type Quote = {
  price: number | null;
  material: number | null;
  materialIncomplete: boolean;
  ink: number | null;
  fees: number | null;
  feesIncomplete: boolean;
  shippingUnknown: boolean;
  profit: number | null;
  marginPercent: number | null;
  tone: "ok" | "yellow" | "red" | "unknown";
  lines: CostLine[];
};

export function quoteSku(input: {
  sku: Sku;
  price: number | null;
  channel: Channel;
  settings: Settings;
  boms: BomLine[];
  materials: Material[];
  affiliate: boolean;
}): Quote {
  const material = materialCost(input.sku, input.boms, input.materials);
  const lines: CostLine[] = [...material.lines];
  if (input.price === null) {
    return {
      price: null,
      material: material.total,
      materialIncomplete: material.incomplete,
      ink: null,
      fees: null,
      feesIncomplete: true,
      shippingUnknown: false,
      profit: null,
      marginPercent: null,
      tone: "unknown",
      lines,
    };
  }
  const ink = (input.price * input.settings.inkPercent) / 100;
  lines.push({ name: "Mực", amount: ink, detail: `${input.settings.inkPercent}% giá bán` });
  const fees = feeLines(input.channel, input.price, input.settings, input.affiliate);
  lines.push(...fees);
  const shippingUnknown = fees.some((f) => f.name.startsWith("Phí ship") && f.amount === null);
  const feeKnown = fees.filter((f) => !(f.name.startsWith("Phí ship") && f.amount === null));
  const feesIncomplete = feeKnown.some((f) => f.amount === null);
  const feeSum = feeKnown.reduce((s, f) => s + (f.amount ?? 0), 0);
  const incomplete = material.incomplete || feesIncomplete;
  const profit = incomplete ? null : input.price - (material.total ?? 0) - ink - feeSum;
  const marginPercent = profit === null || input.price === 0 ? null : (profit / input.price) * 100;
  let tone: Quote["tone"] = "unknown";
  if (profit !== null && marginPercent !== null) {
    if (profit < input.settings.marginRedPercent) tone = "red";
    else if (marginPercent < input.settings.marginYellowPercent) tone = "yellow";
    else tone = "ok";
  }
  return {
    price: input.price,
    material: material.total,
    materialIncomplete: material.incomplete,
    ink,
    fees: feesIncomplete ? null : feeSum,
    feesIncomplete,
    shippingUnknown,
    profit: profit === null ? null : money(profit),
    marginPercent: marginPercent === null ? null : Math.round(marginPercent * 10) / 10,
    tone,
    lines,
  };
}

export function perSheet(price: number, sheets: number): number {
  return price / Math.max(1, sheets);
}

/** Báo lỗi nếu combo sau đắt hơn (tính trên mỗi tấm) so với combo trước. */
export function comboPriceError(
  rows: { sheets: number; price: number | null }[],
): string | null {
  const known = rows
    .filter((r): r is { sheets: number; price: number } => r.price !== null && r.sheets > 0)
    .sort((a, b) => a.sheets - b.sheets);
  for (let i = 1; i < known.length; i++) {
    const prev = known[i - 1]!;
    const cur = known[i]!;
    if (perSheet(cur.price, cur.sheets) > perSheet(prev.price, prev.sheets) + 0.0001) {
      return `Combo ${cur.sheets} tấm có giá mỗi tấm cao hơn combo ${prev.sheets} tấm.`;
    }
  }
  return null;
}

export function commissionOf(
  revenue: number,
  tiers: { upto: number | null; percent: number }[],
): number {
  const sorted = [...tiers].sort((a, b) => (a.upto ?? Infinity) - (b.upto ?? Infinity));
  let cursor = 0;
  let total = 0;
  for (const tier of sorted) {
    const cap = tier.upto ?? revenue;
    const band = Math.max(0, Math.min(revenue, cap) - cursor);
    total += (band * tier.percent) / 100;
    cursor = cap;
    if (cursor >= revenue) break;
  }
  return money(total);
}

export function kpiTarget(openDate: string, month: string, targets: number[]): number {
  const [oy, om] = openDate.split("-").map(Number);
  const [y, m] = month.split("-").map(Number);
  const index = (y! - oy!) * 12 + (m! - om!);
  if (index <= 0) return targets[0] ?? 0;
  if (index === 1) return targets[1] ?? targets[0] ?? 0;
  if (index === 2) return targets[2] ?? targets[targets.length - 1] ?? 0;
  return targets[3] ?? targets[targets.length - 1] ?? 0;
}

/**
 * Số cọc Facebook. `null` = bắt buộc cọc (khổ lớn) nhưng chưa có giá để tính 50%.
 * `0` = không cần cọc.
 */
export function depositFor(order: {
  channel: Channel;
  total: number | null;
  items: { size: string | null }[];
  settings: Settings;
}): number | null {
  if (order.channel !== "facebook") return 0;
  const large = order.items.some((i) => needsLargeDeposit(i.size));
  if (order.total === null) return large ? null : 0;
  const bigMoney = order.total >= order.settings.depositMinTotal;
  if (!large && !bigMoney) return 0;
  return money((order.total * order.settings.depositPercent) / 100);
}

const PROGRESS: OrderStatus[] = ["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong"];

export function statusRank(status: OrderStatus): number {
  return PROGRESS.indexOf(status);
}

const DEPOSIT_GATE: OrderStatus[] = ["thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong"];

export function depositBlocks(status: OrderStatus, depositRequired: number | null, depositPaid: number): boolean {
  if (!DEPOSIT_GATE.includes(status)) return false;
  if (depositRequired === null) return true;
  if (depositRequired <= 0) return false;
  return depositPaid + 0.5 < depositRequired;
}

export function statusChangeError(input: {
  role: "owner" | "sale" | "production";
  ownerOverride: boolean;
  next: OrderStatus;
  depositRequired: number | null;
  depositPaid: number;
}): string | null {
  if (input.role === "production" && !["in", "dong_goi", "giao"].includes(input.next)) {
    return "Sản xuất chỉ chuyển các bước in, đóng gói và giao.";
  }
  if (depositBlocks(input.next, input.depositRequired, input.depositPaid) && !(input.role === "owner" && input.ownerOverride)) {
    if (input.depositRequired === null) {
      return "Đơn Facebook có khổ từ 40×60 cần cọc 50%, nhưng chưa có giá bán để tính số cọc.";
    }
    return "Đơn Facebook chưa ghi đủ cọc 50%. Chưa chuyển sang thiết kế hoặc in.";
  }
  return null;
}

export function comboWarnings(
  skus: { id: string; groupId: string; size: string | null; sheets: number; code: string }[],
  prices: { skuId: string; channel: Channel; price: number | null }[],
  channel: Channel,
): string[] {
  const warnings: string[] = [];
  const groups = new Map<string, typeof skus>();
  for (const sku of skus) {
    if (!sku.size || sku.code.endsWith("-GOI")) continue;
    const key = `${sku.groupId}:${sku.size}`;
    const list = groups.get(key) ?? [];
    list.push(sku);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    const error = comboPriceError(
      list.map((sku) => ({
        sheets: sku.sheets,
        price: prices.find((row) => row.skuId === sku.id && row.channel === channel)?.price ?? null,
      })),
    );
    if (error) warnings.push(`${list[0]!.size} · ${error}`);
  }
  return warnings;
}

export type StockNeed = { materialId: string; qty: number; phase: "print" | "pack" };

/** Định mức in nhân theo số tấm; đóng gói tính 1 lần cho cả kiện (túi vẫn theo số ảnh). */
export function stockNeeds(
  lines: { sku: Sku; quantity: number }[],
  boms: BomLine[],
  phase: "print" | "pack",
): { needs: StockNeed[]; missing: string[] } {
  const needs: StockNeed[] = [];
  const missing: string[] = [];
  if (phase === "print") {
    for (const line of lines) {
      for (const bom of boms.filter((b) => b.skuId === line.sku.id && b.phase === "print")) {
        if (bom.qty === null) {
          missing.push(bom.materialId);
          continue;
        }
        const qty = bom.qty * line.sku.sheets * line.quantity;
        const found = needs.find((n) => n.materialId === bom.materialId);
        if (found) found.qty += qty;
        else needs.push({ materialId: bom.materialId, qty, phase });
      }
    }
    return { needs, missing };
  }
  const packSheet = boms.filter((b) => b.phase === "pack" && b.scope === "sheet");
  for (const line of lines) {
    for (const bom of packSheet.filter((b) => b.skuId === line.sku.id)) {
      if (bom.qty === null) {
        missing.push(bom.materialId);
        continue;
      }
      const qty = bom.qty * line.sku.sheets * line.quantity;
      const found = needs.find((n) => n.materialId === bom.materialId);
      if (found) found.qty += qty;
      else needs.push({ materialId: bom.materialId, qty, phase });
    }
  }
  const parcelMaterials = new Set(
    boms.filter((b) => b.phase === "pack" && b.scope === "parcel").map((b) => b.materialId),
  );
  for (const materialId of parcelMaterials) {
    let best = 0;
    let any = false;
    let unknown = false;
    for (const line of lines) {
      const bom = boms.find((b) => b.skuId === line.sku.id && b.materialId === materialId && b.scope === "parcel");
      if (!bom) continue;
      if (bom.qty === null) {
        unknown = true;
        continue;
      }
      any = true;
      best = Math.max(best, bom.qty);
    }
    if (unknown && !any) missing.push(materialId);
    else if (any) needs.push({ materialId, qty: best, phase });
  }
  return { needs, missing };
}

/** Một chỗ đổi mốc giờ Việt Nam. Tháng lương, hoa hồng, KPI, báo cáo, COD và sao lưu đều đi qua đây. */
export function vnStamp(input: Date | string | null | undefined = new Date()): { ymd: string; month: string; hm: string } {
  if (input == null || input === "") return { ymd: "", month: "", hm: "" };
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return { ymd: "", month: "", hm: "" };
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const ymd = `${parts.year}-${parts.month}-${parts.day}`;
  return { ymd, month: ymd.slice(0, 7), hm: `${parts.hour}:${parts.minute}` };
}

export function vnMonth(input: Date | string | null | undefined = new Date()): string {
  return vnStamp(input).month;
}

export function vnYmd(input: Date | string | null | undefined = new Date()): string {
  return vnStamp(input).ymd;
}

export function vnParts(date = new Date()): { iso: string; hm: string; ymd: string; month: string } {
  const stamp = vnStamp(date);
  return { iso: date.toISOString(), hm: stamp.hm, ymd: stamp.ymd, month: stamp.month };
}

export function minutesLate(hm: string, start: string, grace: number): number {
  const toMin = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return Math.max(0, toMin(hm) - toMin(start) - grace);
}

export function minutesEarly(hm: string, end: string): number {
  const toMin = (value: string) => {
    const [h, m] = value.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return Math.max(0, toMin(end) - toMin(hm));
}

export function isWeeklyOff(ymd: string, weeklyOff: number[]): boolean {
  const [y, m, d] = ymd.split("-").map(Number);
  const weekday = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
  return weeklyOff.includes(weekday);
}

export function collectedRevenue(orders: Order[], month: string): number {
  return orders
    .filter((o) => {
      const stamp = o.completedAt ?? o.updatedAt;
      return o.status === "xong" && stamp != null && vnMonth(stamp) === month;
    })
    .reduce((s, o) => s + (o.total ?? 0), 0);
}

export function priceOf(prices: ChannelPrice[], skuId: string, channel: Channel): ChannelPrice | undefined {
  return prices.find((p) => p.skuId === skuId && p.channel === channel);
}

export function formulaQty(formula: string, sku: Sku, settings: Settings): number | null {
  const w = sku.widthCm;
  const h = sku.heightCm;
  if (formula === "bag" || formula === "label" || formula === "wood" || formula === "stand") return 1;
  if (formula === "hook" || formula === "screw") return 2;
  if (formula === "tape") {
    if (!settings.tapeOrdersPerRoll) return null;
    return round4(1 / settings.tapeOrdersPerRoll);
  }
  if ((formula === "edge" || formula === "foam" || formula === "carton") && w && h) {
    return formula === "edge" ? edgeMeters(w, h) : wrapM2(w, h);
  }
  if ((formula === "pp" || formula === "silk") && w && h) {
    return rollMeters(w, h, settings.ppRollWidthCm, settings.wasteRate);
  }
  if (formula === "film" && w && h) {
    return rollMeters(w, h, settings.filmRollWidthCm, settings.wasteRate);
  }
  if (formula === "pp-pack" || formula === "silk-pack" || formula === "film-pack") {
    if (!w || !h) return null;
    const width = formula === "film-pack" ? settings.filmRollWidthCm : settings.ppRollWidthCm;
    return rollMeters(w, h, width, settings.wasteRate);
  }
  if (formula === "magnet-6x9") {
    if (!settings.magnetPiecesPerSheet) return null;
    return round4(1 / settings.magnetPiecesPerSheet);
  }
  return null;
}

export function groupIsListed(
  settings: Settings,
  group: { id: string; gate: "anh_the" | "album" | null },
): boolean {
  if (group.gate === "anh_the" && !settings.showAnhThe) return false;
  if (group.gate === "album" && !settings.showAlbum) return false;
  return settings.groupListed[group.id] !== false;
}

/** Catalog khách: nhóm đang hiện, biến thể tại tiệm đang bán. Giá null thì requires_quote (chữ Liên hệ). */
export function walkInPublicOffers(state: {
  settings: Settings;
  groups: { id: string; gate: "anh_the" | "album" | null }[];
  skus: { id: string; code: string; groupId: string }[];
  prices: ChannelPrice[];
}): { code: string; groupId: string; price: number | null; requires_quote: boolean }[] {
  return state.groups
    .filter((group) => groupIsListed(state.settings, group))
    .flatMap((group) =>
      state.skus
        .filter((sku) => sku.groupId === group.id)
        .filter((sku) => walkInListed(priceOf(state.prices, sku.id, "tai_tiem")?.status))
        .map((sku) => {
          const price = priceOf(state.prices, sku.id, "tai_tiem")?.price ?? null;
          return { code: sku.code, groupId: group.id, price, requires_quote: price === null };
        }),
    );
}

export function walkInListed(status: ChannelPrice["status"] | undefined): boolean {
  return status === "dang_ban";
}
