import { PRICE_SHEET_20261022 } from "./price-sheet-20261022.ts";
import type { Channel, ChannelPrice, Settings, Sku } from "./types.ts";
import { CHANNELS } from "./types.ts";

/** Tên khách thấy cho ảnh ép gỗ tráng gương. */
export const DESK_PRODUCT_NAME = "Ảnh ép gỗ tráng gương để bàn";

export const DESK_PRODUCT_DESCRIPTION =
  "Ảnh ép gỗ tráng gương để bàn. Khổ 13×18 đến 60×90. Khổ từ 20×30 trở xuống có chân dựng. Từ 30×45 có móc treo tường.";

/** Giá chủ chốt 22/10, thắng mọi ô trong file. */
const PRICE_OVERRIDES: Record<string, number> = {
  "TG-13x18-C1": 35000,
  "TG-13x18-C4": 100000,
};

const PACK_PREFIXES = ["LUA-", "NCT-"];

export type MasterRow = {
  sheetSku: string;
  code: string;
  common: number | null;
  list: number | null;
  sale: number | null;
  cost: number | null;
  note: string;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((item) => item.trim())) rows.push(row);
  }
  return rows;
}

function moneyCell(value: string | undefined): number | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

/** Mã trên bảng → mã trong app. Gói LUA/NCT giữ số tấm. Đơn lẻ `-1` thành `-C1`. `NC-` là nam châm xe `NX-`. */
export function sheetCodeToApp(sheetSku: string): string {
  let code = sheetSku.trim();
  if (code.startsWith("NC-")) code = `NX-${code.slice(3)}`;
  if (PACK_PREFIXES.some((prefix) => code.startsWith(prefix))) return code;
  if (/-\d+$/.test(code) && !/-C\d+$/.test(code)) code = code.replace(/-(\d+)$/, "-C$1");
  return code;
}

export function parseMasterSheet(text = PRICE_SHEET_20261022): MasterRow[] {
  const rows = parseCsv(text);
  const header = rows.findIndex((row) => row[0]?.trim() === "SKU");
  if (header < 0) return [];
  const parsed: MasterRow[] = [];
  for (const row of rows.slice(header + 1)) {
    const sheetSku = row[0]?.trim() ?? "";
    if (!sheetSku || sheetSku.startsWith("Tổng")) continue;
    parsed.push({
      sheetSku,
      code: sheetCodeToApp(sheetSku),
      common: moneyCell(row[4]),
      list: moneyCell(row[5]),
      sale: moneyCell(row[6]),
      cost: moneyCell(row[8]),
      note: (row[17] ?? "").trim(),
    });
  }
  return parsed;
}

export function masterByCode(text = PRICE_SHEET_20261022): Map<string, MasterRow> {
  return new Map(parseMasterSheet(text).map((row) => [row.code, row]));
}

function walkPrice(row: MasterRow): number | null {
  return PRICE_OVERRIDES[row.code] ?? row.common;
}

function marketPrice(row: MasterRow): number | null {
  if (row.list === null && row.sale === null) return null;
  return PRICE_OVERRIDES[row.code] ?? row.sale ?? row.common;
}

function priceNote(row: MasterRow, channel: Channel): string {
  const override = PRICE_OVERRIDES[row.code];
  if (override !== undefined && (channel === "tai_tiem" || channel === "facebook" || channel === "tiktok" || channel === "shopee")) {
    if (row.code === "TG-13x18-C1") return "Chủ chốt 22/10: 35.000đ (bảng ghi 37.000).";
    if (row.code === "TG-13x18-C4") return "Chủ chốt 22/10: combo 4 = 100.000đ.";
  }
  if ((channel === "tiktok" || channel === "shopee") && row.list === null && row.sale === null) {
    return row.note || "Chỉ bán tại tiệm và Facebook.";
  }
  if (row.code === "NX-12x25-C1") return "Đổi từ 9×19 ngày 22/10. Vốn vật tư là ước tính.";
  if (row.note) return row.note;
  if (channel === "tiktok" || channel === "shopee") return "Giá sau giảm 22/10. Niêm yết = giá chung × 1,35.";
  return "Giá chung 22/10 cho tại tiệm, web và Facebook.";
}

export function channelPriceFor(sku: { id: string; code: string }, channel: Channel, row: MasterRow | undefined): ChannelPrice {
  if (!row) {
    return { skuId: sku.id, channel, price: null, status: "nhap", note: "" };
  }
  const price = channel === "tiktok" || channel === "shopee" ? marketPrice(row) : walkPrice(row);
  const listPrice = channel === "tiktok" || channel === "shopee" ? row.list : null;
  return {
    skuId: sku.id,
    channel,
    price,
    status: price === null ? "nhap" : "dang_ban",
    note: priceNote(row, channel),
    ...(listPrice !== null ? { listPrice } : {}),
  };
}

export function catalogPrices(skus: { id: string; code: string }[]): ChannelPrice[] {
  const rows = masterByCode();
  const prices: ChannelPrice[] = [];
  for (const sku of skus) {
    const row = rows.get(sku.code);
    for (const channel of CHANNELS) prices.push(channelPriceFor(sku, channel, row));
  }
  return prices;
}

export function sheetCostFor(code: string): number | null {
  return masterByCode().get(code)?.cost ?? null;
}

export function stampSheetCosts(skus: Sku[]): void {
  for (const sku of skus) {
    const cost = sheetCostFor(sku.code);
    if (cost !== null) sku.sheetCost = cost;
  }
}

/** Mức tồn tối thiểu trên tab tồn kho 22/10. Không ghi số tồn. */
export const MIN_STOCK_20261022: Record<string, number> = {
  "giay-pp": 1,
  "giay-lua": 1,
  mang: 1,
  muc: 2,
  "nam-cham": 2,
  vien: 1,
  "go-13x18": 30,
  "go-15x21": 30,
  "go-20x30": 30,
  "go-30x45": 15,
  "go-40x60": 10,
  "go-50x75": 5,
  "go-60x90": 5,
  chan: 50,
  moc: 50,
  oc: 100,
  tui: 200,
  xop: 1,
  "bang-keo": 5,
  carton: 1,
  tem: 1,
  "bien-nhan": 1,
};

export function applyFeeSettings(settings: Settings): void {
  settings.inkPercent = 4.4;
  settings.tiktokFeePercent = 27;
  settings.tiktokExtraPercent = 0;
  settings.tiktokFixed = 11000;
  settings.tiktokTaxPercent = 0;
  settings.tiktokCommissionPercent = 0;
  settings.tiktokAffiliatePercent = 0;
  settings.shopeeFeePercent = 27;
  settings.shopeeExtraPercent = 0;
  settings.shopeeInfra = 11000;
  settings.shopeePiship = 0;
  settings.shopeeTaxPercent = 0;
  settings.shopeeCommissionPercent = 0;
  settings.shopeeAffiliatePercent = 0;
  settings.fbTaxPercent = 0;
  settings.fbCommissionPercent = 3;
  settings.fbAdsPercent = 10;
  settings.fbCodPercent = 0;
  settings.fbShipping = null;
  settings.fbPackFixed = 8000;
  settings.walkinCommissionPercent = 3;
  settings.breakevenMonth = 45126608;
  settings.workingDays = 26;
  settings.breakevenDay = Math.round(45126608 / 26);
  settings.publicHours = "08:00–18:00";
  settings.platformFeeNote =
    "Hoạch toán sàn: 27% + 11.000đ/đơn. Bảng phí từng hạng mục trong file Phi-san ghi chưa xác minh, chỉ để đối chiếu.";
  const wage = settings.fixedCosts.find((row) => row.key === "luong_sx");
  if (wage) {
    wage.amount = 5500000;
    wage.note = "Lương sản xuất 11.000.000đ. Tiệm chịu 50% vì chia với Mơ Home. Duyệt 22/10.";
  }
  const other = settings.fixedCosts.find((row) => row.key === "khac");
  if (other) other.note = "Cộng các khoản là 23.900.000đ/tháng.";
  settings.hrDraft = {
    pendingOwnerApproval: true,
    note: "Đề xuất từ tab lương/KPI. KPI 20/40/60 triệu là doanh thu, không phải mốc hoa hồng. Tháng 1 trong mô tả việc cũ là 25 triệu; bảng hòa vốn bắt đầu từ tháng 2.",
    saleBase: 8000000,
    probationPercent: 85,
    productionBase: 11000000,
    olderJdMonth1: 25000000,
    kpiMonth2: 20000000,
    kpiMonth3: 40000000,
    kpiFromMonth4: 60000000,
    commissionTiers: [
      { upto: 100000000, percent: 3 },
      { upto: 200000000, percent: 5 },
      { upto: null, percent: 7 },
    ],
  };
}

export type CatalogCounts = {
  sheetRows: number;
  pricedSkus: number;
  pricedCells: number;
  inactiveSkus: number;
  unpricedCodes: string[];
};

export function catalogCounts(skus: { id: string; code: string }[], prices: ChannelPrice[]): CatalogCounts {
  const rows = parseMasterSheet();
  const priced = new Set(prices.filter((row) => row.price !== null).map((row) => row.skuId));
  const unpricedCodes = skus.filter((sku) => !priced.has(sku.id)).map((sku) => sku.code);
  return {
    sheetRows: rows.length,
    pricedSkus: priced.size,
    pricedCells: prices.filter((row) => row.price !== null).length,
    inactiveSkus: unpricedCodes.length,
    unpricedCodes,
  };
}
