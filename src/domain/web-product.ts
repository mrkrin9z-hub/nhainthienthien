import { comboPriceError } from "./calc.ts";
import { CHANNELS, type ChannelPrice, type Group, type Sku } from "./types.ts";

export type WebSizeInput = {
  widthCm: number;
  heightCm: number;
  sheets: number;
  price: number;
};

export type WebProductInput = {
  name: string;
  category: string;
  description: string;
  turnaround: string;
  sizes: WebSizeInput[];
};

export type BuiltWebProduct = {
  group: Group;
  skus: Sku[];
  prices: ChannelPrice[];
};

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
    price: whole(size.price, "Giá", 1000, 100_000_000),
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
    });
    for (const channel of CHANNELS) {
      prices.push({
        skuId: code,
        channel,
        price: channel === "tai_tiem" ? size.price : null,
        status: channel === "tai_tiem" ? "dang_ban" : "nhap",
        note: channel === "tai_tiem" ? "Thêm từ quản trị" : "",
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
