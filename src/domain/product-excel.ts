import { CHANNEL_LABEL, CHANNELS, type Channel } from "./types.ts";
import type { WebProductInput, WebSizeInput } from "./web-product.ts";
import { normalizeProductCode, productCodeFromName } from "./web-product.ts";

const SOLD_YES = new Set(["1", "true", "yes", "y", "có", "co", "đang bán", "dang ban", "bán", "ban"]);

export type ProductExcelRow = {
  code: string;
  name: string;
  category: string;
  description: string;
  widthCm: number;
  heightCm: number;
  sheets: number;
  channel: Channel;
  price: number | null;
  sold: boolean;
};

export type ProductExcelDraft = WebProductInput & { code: string };

export function productExcelHeaders(): string[] {
  const headers = ["Mã", "Tên", "Nhóm", "Mô tả", "Rộng (cm)", "Cao (cm)", "Số tấm"];
  for (const channel of CHANNELS) {
    headers.push(`Giá ${CHANNEL_LABEL[channel]}`, `Bán ${CHANNEL_LABEL[channel]}`);
  }
  return headers;
}

export function productExcelTemplateRows(): (string | number | null)[][] {
  return [
    productExcelHeaders(),
    [
      "AEG",
      "Ảnh ép gỗ",
      "Ảnh gỗ",
      "Ví dụ sản phẩm",
      15,
      21,
      1,
      ...CHANNELS.flatMap((channel) => (channel === "tai_tiem" || channel === "facebook" ? [45000, "có"] : ["", "không"])),
    ],
    [
      "AEG",
      "Ảnh ép gỗ",
      "Ảnh gỗ",
      "Ví dụ sản phẩm",
      20,
      30,
      1,
      ...CHANNELS.flatMap((channel) => (channel === "tai_tiem" || channel === "facebook" ? [65000, "có"] : ["", "không"])),
    ],
  ];
}

function moneyCell(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const text = value.trim().replace(/\s/g, "").replace(/đ$/i, "").replace(/vnd$/i, "").replace(/\./g, "").replace(/,/g, "");
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

function intCell(value: string | undefined, label: string): number {
  const n = Number(String(value ?? "").trim().replace(/\s/g, ""));
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) throw new Error(`${label} không hợp lệ.`);
  return n;
}

function soldCell(value: string | undefined, hasPrice: boolean): boolean {
  if (!value?.trim()) return hasPrice;
  return SOLD_YES.has(value.trim().toLowerCase());
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function channelFromHeader(header: string): { channel: Channel; kind: "price" | "sold" } | null {
  const tidy = (value: string) =>
    fold(value)
      .replace(/\s*\(.*?\)\s*/g, " ")
      .replace(/\//g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const plain = tidy(header);
  for (const channel of CHANNELS) {
    const label = tidy(CHANNEL_LABEL[channel]);
    if (plain === `gia ${label}` || plain === `price ${channel}` || plain.startsWith(`gia ${label}`)) {
      return { channel, kind: "price" };
    }
    if (plain === `ban ${label}` || plain === `sold ${channel}` || plain.startsWith(`ban ${label}`)) {
      return { channel, kind: "sold" };
    }
  }
  return null;
}

/** Gom các dòng Excel rộng (một khổ / dòng, cột giá từng kênh) thành draft sản phẩm. */
export function parseProductExcel(rows: string[][]): ProductExcelDraft[] {
  if (!rows.length) throw new Error("File trống.");
  const header = rows[0]!.map((cell) => String(cell ?? "").trim());
  const folded = header.map((h) => fold(h));
  const idx = {
    code: folded.findIndex((h) => h === "ma" || h === "code"),
    name: folded.findIndex((h) => h.startsWith("ten") || h === "name"),
    category: folded.findIndex((h) => h.startsWith("nhom") || h === "category"),
    description: folded.findIndex((h) => h.startsWith("mo ta") || h.startsWith("desc")),
    width: folded.findIndex((h) => h.startsWith("rong") || h.startsWith("width")),
    height: folded.findIndex((h) => h.startsWith("cao") || h.startsWith("height")),
    sheets: folded.findIndex((h) => h.startsWith("so tam") || h === "sheets" || h === "sheet"),
  };
  if (idx.name < 0 || idx.category < 0 || idx.width < 0 || idx.height < 0) {
    throw new Error("Thiếu cột bắt buộc: Tên, Nhóm, Rộng, Cao.");
  }
  const channelCols: { index: number; channel: Channel; kind: "price" | "sold" }[] = [];
  header.forEach((title, index) => {
    const hit = channelFromHeader(title);
    if (hit) channelCols.push({ index, ...hit });
  });
  if (!channelCols.some((col) => col.kind === "price")) {
    throw new Error("Thiếu cột giá kênh (vd Giá Tại tiệm).");
  }

  const byCode = new Map<string, ProductExcelDraft>();
  rows.slice(1).forEach((row, rowIndex) => {
    if (!row.some((cell) => String(cell ?? "").trim())) return;
    const line = rowIndex + 2;
    const name = String(row[idx.name] ?? "").trim();
    const category = String(row[idx.category] ?? "").trim();
    if (!name || !category) throw new Error(`Dòng ${line}: thiếu tên hoặc nhóm.`);
    const code =
      normalizeProductCode(String(row[idx.code] ?? ""))
      || normalizeProductCode(productCodeFromName(name));
    if (!code) throw new Error(`Dòng ${line}: thiếu mã sản phẩm.`);
    const description = idx.description >= 0 ? String(row[idx.description] ?? "").trim() : "";
    const widthCm = intCell(row[idx.width], `Dòng ${line}: rộng`);
    const heightCm = intCell(row[idx.height], `Dòng ${line}: cao`);
    const sheets = idx.sheets >= 0 ? intCell(row[idx.sheets] || "1", `Dòng ${line}: số tấm`) : 1;

    const quotes: NonNullable<WebSizeInput["quotes"]> = {};
    for (const channel of CHANNELS) {
      quotes[channel] = { price: null, sold: false };
    }
    for (const col of channelCols) {
      const raw = String(row[col.index] ?? "");
      const current = quotes[col.channel] ?? { price: null, sold: false };
      if (col.kind === "price") {
        current.price = moneyCell(raw);
      } else {
        current.sold = soldCell(raw, current.price != null);
      }
      quotes[col.channel] = current;
    }
    for (const channel of CHANNELS) {
      const quote = quotes[channel]!;
      if (quote.sold == null) quote.sold = quote.price != null;
      if (quote.sold && quote.price == null) {
        throw new Error(`Dòng ${line}: kênh ${CHANNEL_LABEL[channel]} đang bán nhưng chưa có giá.`);
      }
      if (!quote.sold) quote.price = quote.price ?? null;
    }
    const retail = quotes.tai_tiem?.price ?? CHANNELS.map((c) => quotes[c]?.price).find((p): p is number => p != null);
    if (retail == null) throw new Error(`Dòng ${line}: cần ít nhất một giá kênh.`);

    const size: WebSizeInput = {
      widthCm,
      heightCm,
      sheets,
      price: retail,
      quotes,
    };

    const existing = byCode.get(code);
    if (!existing) {
      byCode.set(code, {
        code,
        name,
        category,
        description,
        turnaround: "",
        sizes: [size],
        listed: false,
      });
      return;
    }
    existing.name = name;
    existing.category = category;
    if (description) existing.description = description;
    const dup = existing.sizes.find(
      (item) => item.widthCm === widthCm && item.heightCm === heightCm && item.sheets === sheets,
    );
    if (dup) {
      dup.price = size.price;
      if (size.quotes) dup.quotes = size.quotes;
    } else {
      existing.sizes.push(size);
    }
  });

  const drafts = [...byCode.values()];
  if (!drafts.length) throw new Error("Không có dòng sản phẩm hợp lệ.");
  return drafts;
}

export function productsToExcelRows(
  products: {
    code: string;
    name: string;
    category: string;
    description: string;
    sizes: {
      widthCm: number;
      heightCm: number;
      sheets: number;
      quotes: Record<string, { price: number | null; sold: boolean }>;
    }[];
  }[],
): (string | number | null)[][] {
  const rows: (string | number | null)[][] = [productExcelHeaders()];
  for (const product of products) {
    for (const size of product.sizes) {
      rows.push([
        product.code,
        product.name,
        product.category,
        product.description,
        size.widthCm,
        size.heightCm,
        size.sheets,
        ...CHANNELS.flatMap((channel) => {
          const quote = size.quotes[channel];
          return [quote?.price ?? "", quote?.sold ? "có" : "không"];
        }),
      ]);
    }
  }
  return rows;
}
