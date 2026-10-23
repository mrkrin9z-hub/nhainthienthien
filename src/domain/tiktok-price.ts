/** Giá khách trả = giá sau giảm trên bảng TikTok 23/10. Niêm yết lưu riêng. */

export type TiktokQuote = { sale: number | null; list: number | null };

/** Dấu chấm ngăn nghìn: 88.000 → 88000, 1.199.000 → 1199000. */
export function parseDottedAmount(value: string | undefined): number | null {
  const text = (value ?? "").trim().replace(/đ/gi, "").replace(/\s/g, "");
  if (!text) return null;
  if (!/^\d{1,3}(\.\d{3})+$/.test(text) && !/^\d+$/.test(text)) return null;
  const amount = Number(text.replace(/\./g, ""));
  return Number.isFinite(amount) ? amount : null;
}

/** Phần trăm dấu phẩy: 26,1% → 26.1. */
export function parseCommaPercent(value: string | undefined): number | null {
  const text = (value ?? "").trim().replace(/%/g, "").replace(/\s/g, "");
  if (!text) return null;
  if (!/^\d+(,\d+)?$/.test(text) && !/^\d+(\.\d+)?$/.test(text)) return null;
  const amount = Number(text.replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}

type Pair = { sale: number; list: number };

/** Giá ảnh gỗ (TG, AT, GK) và phần lớn khung EG. Combo 2 khổ 40×60 không có trong file. */
const WOOD: Record<string, Record<number, Pair>> = {
  "13x18": {
    1: { sale: 37000, list: 70000 },
    2: { sale: 69000, list: 131000 },
    3: { sale: 89000, list: 169000 },
    4: { sale: 100000, list: 190000 },
    5: { sale: 125000, list: 226000 },
  },
  "15x21": {
    1: { sale: 39000, list: 74000 },
    2: { sale: 74000, list: 141000 },
    3: { sale: 109000, list: 207000 },
    4: { sale: 139000, list: 264000 },
    5: { sale: 169000, list: 321000 },
  },
  "20x30": {
    1: { sale: 56000, list: 106000 },
    2: { sale: 109000, list: 207000 },
    3: { sale: 159000, list: 302000 },
    4: { sale: 199000, list: 378000 },
    5: { sale: 239000, list: 454000 },
  },
  "30x45": {
    1: { sale: 86000, list: 163000 },
    2: { sale: 165000, list: 314000 },
    3: { sale: 239000, list: 454000 },
    4: { sale: 309000, list: 587000 },
    5: { sale: 379000, list: 720000 },
  },
  "40x60": {
    1: { sale: 149000, list: 283000 },
    3: { sale: 409000, list: 777000 },
    4: { sale: 539000, list: 1024000 },
    5: { sale: 669000, list: 1252000 },
  },
  "50x75": {
    1: { sale: 239000, list: 454000 },
    2: { sale: 459000, list: 849000 },
    3: { sale: 659000, list: 1219000 },
    4: { sale: 859000, list: 1632000 },
    5: { sale: 1059000, list: 1919000 },
  },
  "60x90": {
    1: { sale: 319000, list: 606000 },
    2: { sale: 609000, list: 1199000 },
    3: { sale: 879000, list: 1719000 },
    4: { sale: 1149000, list: 2183000 },
    5: { sale: 1419000, list: 2719000 },
  },
};

/** Niêm yết listing khung EG khi khác ảnh để bàn. Giá khách trả vẫn trùng. */
const EG_LIST: Record<string, number> = {
  "40x60-C5": 1271000,
  "50x75-C2": 872000,
  "50x75-C3": 1252000,
  "50x75-C5": 2012000,
  "60x90-C2": 1157000,
  "60x90-C3": 1670000,
  "60x90-C5": 2696000,
};

const DIRECT: Record<string, Pair> = {
  "NX-12x25-C1": { sale: 65000, list: 88000 },
  "TKB-20x30-C1": { sale: 70000, list: 95000 },
  "TKB-20x30-C2": { sale: 119000, list: 226000 },
  "TKB-20x30-C3": { sale: 159000, list: 302000 },
  "NCT-6x9-5": { sale: 50000, list: 95000 },
  "NCT-6x9-10": { sale: 90000, list: 171000 },
  "NCT-6x9-20": { sale: 165000, list: 314000 },
  "NCT-6x9-50": { sale: 375000, list: 713000 },
};

const WOOD_PREFIX = new Set(["TG", "AT", "GK", "EG"]);
const EG_SIZE = new Set(["40x60", "50x75", "60x90"]);

/**
 * undefined = bảng 23/10 không có mã này, giữ giá cũ.
 * sale null = chủ chưa chốt (combo 2 ảnh 40×60).
 */
export function tiktokPriceFor(code: string): TiktokQuote | undefined {
  const direct = DIRECT[code];
  if (direct) return direct;
  const match = /^([A-Z]+)-(\d+x\d+)-C(\d+)$/.exec(code);
  if (!match) return undefined;
  const prefix = match[1]!;
  const size = match[2]!;
  const combo = Number(match[3]);
  if (!WOOD_PREFIX.has(prefix)) return undefined;
  if (prefix === "EG" && !EG_SIZE.has(size)) return undefined;
  if (prefix === "AT" && (size === "13x18" || size === "15x21")) return undefined;
  if (size === "40x60" && combo === 2) return { sale: null, list: null };
  const row = WOOD[size]?.[combo];
  if (!row) return undefined;
  const list = prefix === "EG" ? (EG_LIST[`${size}-C${combo}`] ?? row.list) : row.list;
  return { sale: row.sale, list };
}
