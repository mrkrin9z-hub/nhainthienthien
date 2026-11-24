import { comboPriceError } from "./calc.ts";
import { CHANNELS, type Channel, type ChannelPrice, type Group, type Sku } from "./types.ts";

export type WebChannelQuote = {
  price?: number | null;
  listPrice?: number | null;
  minTotal?: number | null;
  sold?: boolean;
};

export type WebSizeInput = {
  skuId?: string;
  widthCm: number;
  heightCm: number;
  sheets: number;
  price: number;
  prices?: Partial<Record<Channel, number>>;
  quotes?: Partial<Record<Channel, WebChannelQuote>>;
  minTotal?: number | null;
};

export type WebProductInput = {
  name: string;
  category: string;
  description: string;
  turnaround: string;
  sizes: WebSizeInput[];
  listed?: boolean;
};

export type BuiltWebProduct = {
  group: Group;
  skus: Sku[];
  prices: ChannelPrice[];
};


export function channelQuotes(size: WebSizeInput): Record<Channel, { price: number | null; listPrice: number | null; minTotal: number | null; sold: boolean }> {
  const out = {} as Record<Channel, { price: number | null; listPrice: number | null; minTotal: number | null; sold: boolean }>;
  for (const channel of CHANNELS) {
    const quote = size.quotes?.[channel];
    const fallback = channel === "tai_tiem" ? size.price : (size.prices?.[channel] ?? null);
    const price = quote?.price !== undefined ? quote.price : (fallback ?? null);
    const minTotal = quote?.minTotal !== undefined ? quote.minTotal : (channel === "tai_tiem" ? (size.minTotal ?? null) : null);
    const sold = quote?.sold ?? price != null;
    if (sold && (price == null || !Number.isFinite(price))) {
      throw new Error(`Kênh đang bán cần có giá (khổ ${size.widthCm}×${size.heightCm} cm).`);
    }
    out[channel] = {
      price: price ?? null,
      listPrice: quote?.listPrice ?? null,
      minTotal: minTotal && minTotal > 0 ? minTotal : null,
      sold: Boolean(sold && price != null),
    };
  }
  return out;
}

/** Bỏ dấu tiếng Việt để làm đường dẫn sản phẩm. */
export function slugifyProductName(name: string): string {
  const plain = name
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = plain.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.slice(0, 48) || "san-pham";
}

export function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function clean(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function whole(value: number, label: string, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} phải là số nguyên từ ${min} đến ${max}.`);
  }
  return value;
}

/** Tạo nhóm, quy cách và giá tại tiệm. Kênh sàn để trống cho đến khi chủ sửa ở bảng giá. */
export function buildWebProduct(
  input: WebProductInput,
  existing: { slugs: string[]; ids: string[]; codes: string[]; sorts: number[] },
): BuiltWebProduct {
  const name = clean(input.name, 80);
  const category = clean(input.category, 40);
  const description = clean(input.description, 400);
  const turnaround = clean(input.turnaround, 80);
  if (name.length < 2) throw new Error("Nhập tên sản phẩm.");
  if (category.length < 2) throw new Error("Nhập nhóm, ví dụ Ảnh gỗ.");
  if (!input.sizes.length) throw new Error("Thêm ít nhất một khổ và giá.");

  const sizes = input.sizes.map((size) => ({
    widthCm: whole(size.widthCm, "Chiều rộng", 1, 200),
    heightCm: whole(size.heightCm, "Chiều cao", 1, 200),
    sheets: whole(size.sheets, "Số tấm", 1, 100),
    price: whole(size.price, "Giá tại tiệm", 1000, 100_000_000),
    prices: size.prices,
    quotes: size.quotes,
    minTotal: size.minTotal ?? null,
    skuId: size.skuId,
  }));
  const seen = new Set<string>();
  for (const size of sizes) {
    const key = `${size.widthCm}x${size.heightCm}x${size.sheets}`;
    if (seen.has(key)) throw new Error(`Khổ ${size.widthCm}×${size.heightCm} cm đã có ${size.sheets} tấm.`);
    seen.add(key);
  }
  const bySize = new Map<string, { sheets: number; price: number }[]>();
  for (const size of sizes) {
    const key = `${size.widthCm}x${size.heightCm}`;
    const rows = bySize.get(key) ?? [];
    rows.push({ sheets: size.sheets, price: size.price });
    bySize.set(key, rows);
  }
  for (const rows of bySize.values()) {
    const error = comboPriceError(rows);
    if (error) throw new Error(error);
  }

  const slug = uniqueKey(slugifyProductName(name), new Set(existing.slugs));
  const id = uniqueKey(slug.replace(/-/g, "_"), new Set(existing.ids));
  const takenCodes = new Set(existing.codes);
  const skus: Sku[] = [];
  const prices: ChannelPrice[] = [];
  const ordered = [...sizes].sort((a, b) => a.widthCm - b.widthCm || a.heightCm - b.heightCm || a.sheets - b.sheets);
  ordered.forEach((size, index) => {
    const stem = `WEB-${slug.slice(0, 24)}-${size.widthCm}x${size.heightCm}-${size.sheets}`;
    const code = uniqueKey(stem, takenCodes);
    takenCodes.add(code);
    const quotes = channelQuotes(size);
    const soldOn = CHANNELS.filter((channel) => quotes[channel].sold);
    skus.push({
      id: code,
      code,
      groupId: id,
      name: size.sheets === 1 ? `${size.widthCm}×${size.heightCm} cm` : `${size.widthCm}×${size.heightCm} cm · ${size.sheets} tấm`,
      size: `${size.widthCm}x${size.heightCm}`,
      widthCm: size.widthCm,
      heightCm: size.heightCm,
      sheets: size.sheets,
      piecesPerPack: null,
      sort: index + 1,
      soldOn,
    });
    for (const channel of CHANNELS) {
      const quote = quotes[channel];
      prices.push({
        skuId: code,
        channel,
        price: quote.price,
        status: quote.sold && quote.price != null ? "dang_ban" : "nhap",
        note: channel === "tai_tiem" ? "Thêm từ quản trị" : "",
        ...(quote.listPrice != null ? { listPrice: quote.listPrice } : {}),
        ...(quote.minTotal ? { minTotal: quote.minTotal } : {}),
      });
    }
  });

  const group: Group = {
    id,
    name,
    slug,
    category,
    description,
    turnaround,
    sort: Math.max(0, ...existing.sorts) + 1,
    gate: null,
  };
  return { group, skus, prices };
}
