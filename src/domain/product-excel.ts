import { CHANNEL_LABEL, CHANNELS, type Channel } from "./types.ts";
import type { WebProductInput, WebSizeInput } from "./web-product.ts";
import { normalizeProductCode, productCodeFromName, suggestProductCode } from "./web-product.ts";

const SOLD_YES = new Set(["1", "true", "yes", "y", "có", "co", "đang bán", "dang ban", "bán", "ban"]);

export type ProductExcelDraft = WebProductInput & { code: string };

export function productExcelHeaders(): string[] {
  const headers = ["Mã", "Tên", "Nhóm", "Mô tả", "Rộng (cm)", "Cao (cm)", "Số tấm"];
  for (const channel of CHANNELS) {
    headers.push(`Giá ${CHANNEL_LABEL[channel]}`, `Bán ${CHANNEL_LABEL[channel]}`);
  }
  return headers;
}

/** Mẫu: mỗi dòng = 1 sản phẩm (1 khổ hoặc 1 combo), cùng nhóm Tráng gương. */
export function productExcelTemplateRows(): (string | number | null)[][] {
  return [
    productExcelHeaders(),
    [
      "TG-13x18",
      "Tráng gương 13×18 cm",
      "Tráng gương",
      "Một khổ = một mã",
      13,
      18,
      1,
      ...CHANNELS.flatMap((channel) => (channel === "tai_tiem" || channel === "facebook" ? [45000, "có"] : ["", "không"])),
    ],
    [
      "Combo13x18-02",
      "Tráng gương Combo 13×18 · 2 tấm",
      "Tráng gương",
      "Combo là mã riêng, giá nhập tay",
      13,
      18,
      2,
      ...CHANNELS.flatMap((channel) => (channel === "tai_tiem" || channel === "facebook" ? [80000, "có"] : ["", "không"])),
    ],
    [
      "TG-20x30",
      "Tráng gương 20×30 cm",
      "Tráng gương",
      "",
      20,
      30,
      1,
      ...CHANNELS.flatMap((channel) => (channel === "tai_tiem" ? [65000, "có"] : ["", "không"])),
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

/** Mỗi dòng Excel = một sản phẩm (một mã). Trùng mã trong file → lỗi rõ. */
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

  const drafts: ProductExcelDraft[] = [];
  const seen = new Map<string, number>();
  rows.slice(1).forEach((row, rowIndex) => {
    if (!row.some((cell) => String(cell ?? "").trim())) return;
    const line = rowIndex + 2;
    const name = String(row[idx.name] ?? "").trim();
    const category = String(row[idx.category] ?? "").trim();
    if (!name || !category) throw new Error(`Dòng ${line}: thiếu tên hoặc nhóm.`);
    const widthCm = intCell(row[idx.width], `Dòng ${line}: rộng`);
    const heightCm = intCell(row[idx.height], `Dòng ${line}: cao`);
    const sheets = idx.sheets >= 0 ? intCell(row[idx.sheets] || "1", `Dòng ${line}: số tấm`) : 1;
    const code =
      normalizeProductCode(String(row[idx.code] ?? ""))
      || suggestProductCode({ category, widthCm, heightCm, sheets })
      || normalizeProductCode(productCodeFromName(name));
    if (!code) throw new Error(`Dòng ${line}: thiếu mã sản phẩm.`);
    const prev = seen.get(code.toLowerCase());
    if (prev != null) {
      throw new Error(
        `Dòng ${line}: mã ${code} trùng dòng ${prev}. Mỗi khổ/combo phải có mã riêng (vd TG-13x18 và Combo13x18-02).`,
      );
    }
    seen.set(code.toLowerCase(), line);
    const description = idx.description >= 0 ? String(row[idx.description] ?? "").trim() : "";

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

    drafts.push({
      code,
      name,
      category,
      description,
      turnaround: "",
      sizes: [{ widthCm, heightCm, sheets, price: retail, quotes }],
      listed: false,
    });
  });

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
    const size = product.sizes[0];
    if (!size) continue;
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
  return rows;
}
