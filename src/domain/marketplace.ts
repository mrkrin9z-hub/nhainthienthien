import type { SkuMap } from "./types.ts";

export type MarketplaceChannel = "tiktok" | "shopee";

/**
 * Cột file xuất Seller Center. Khớp tên tiếng Việt hoặc tiếng Anh, không phụ thuộc thứ tự.
 * API TikTok/Shopee sau này trả cùng một bảng này qua MarketplaceOrderAdapter.
 */
export const COLUMN_ALIASES = {
  orderId: ["order id", "order sn", "order number", "ordersn", "ma don hang", "ma don"],
  sku: ["seller sku", "sku reference no", "sku reference", "product sku", "ma sku phan loai", "ma sku", "seller sku id"],
  name: ["product name", "item name", "variation name", "ten san pham", "ten phan loai"],
  qty: ["quantity", "qty", "so luong"],
  phone: ["phone number", "recipient phone", "so dien thoai", "sdt", "phone"],
  buyer: ["recipient name", "recipient", "buyer username", "customer name", "ten nguoi nhan", "nguoi nhan"],
  address: ["delivery address", "full address", "dia chi nhan hang", "dia chi"],
  tracking: ["tracking number", "tracking id", "ma van don", "tracking"],
  carrier: ["shipping provider", "shipping option", "logistics provider", "don vi van chuyen", "hang van chuyen", "carrier"],
  shipFee: ["shipping fee", "phi van chuyen", "ship fee"],
  cod: ["cod amount", "tien thu ho", "cod"],
} as const;

export const EXPECTED_COLUMNS = [
  "Mã đơn sàn (Order ID / Mã đơn hàng)",
  "SKU người bán (Seller SKU / Mã SKU)",
  "Tên sản phẩm",
  "Số lượng",
  "Tên người nhận",
  "Số điện thoại",
  "Địa chỉ",
  "Đơn vị vận chuyển",
  "Mã vận đơn",
  "Phí vận chuyển",
  "Tiền thu hộ COD",
];

export type MarketplaceOrderAdapter = {
  id: "file" | "tiktok-api" | "shopee-api";
  channel: MarketplaceChannel;
  /** Bảng có hàng tiêu đề. File hôm nay. API sau này cùng kiểu, chưa gọi. */
  loadTable(input: { filename: string; bytes: Uint8Array }): Promise<string[][]> | string[][];
};

/** Adapter đang chạy. API TikTok/Shopee sẽ là adapter khác, cùng loadTable, khi Kết nối có khóa. */
export function fileOrderAdapter(channel: MarketplaceChannel): MarketplaceOrderAdapter {
  return {
    id: "file",
    channel,
    async loadTable({ filename, bytes }) {
      const { rowsFromUpload } = await import("./sheet.ts");
      return rowsFromUpload(filename, bytes);
    },
  };
}

export type ParsedLine = {
  orderId: string;
  sku: string;
  name: string;
  qty: number;
  buyer: string;
  phone: string;
  address: string;
  tracking: string;
  carrier: string;
  shipFee: number | null;
  codAmount: number | null;
};

export type ImportIssue = {
  orderId: string;
  sku: string;
  name: string;
  reason: string;
};

export type PlannedItem = {
  skuId: string;
  quantity: number;
  externalSku: string;
  name: string;
};

export type PlannedOrder = {
  platformOrderId: string;
  buyer: string;
  phone: string;
  address: string;
  carrier: string;
  tracking: string;
  shipFee: number | null;
  codAmount: number | null;
  status: "nhan_don";
  items: PlannedItem[];
};

export function foldHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseMoney(raw: string): number | null {
  const text = raw.replace(/[^\d,.-]/g, "").trim();
  if (!text || text === "-" || text === ".") return null;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normal = text;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normal = text.replaceAll(thousands, "").replace(decimal, ".");
  } else if (lastComma >= 0) {
    normal = /,\d{3}($|,)/.test(text) ? text.replaceAll(",", "") : text.replace(",", ".");
  } else if (lastDot >= 0) {
    normal = /\.\d{3}($|\.)/.test(text) ? text.replaceAll(".", "") : text;
  }
  const value = Number(normal);
  return Number.isFinite(value) ? Math.round(value) : null;
}

type Field = keyof typeof COLUMN_ALIASES;

export function mapColumns(headers: string[]): Partial<Record<Field, number>> {
  const folded = headers.map((header) => foldHeader(header));
  const aliases = (Object.entries(COLUMN_ALIASES) as [Field, readonly string[]][])
    .flatMap(([field, names]) => names.map((name) => ({ field, name: foldHeader(name) })))
    .sort((a, b) => b.name.length - a.name.length);
  const used = new Set<number>();
  const out: Partial<Record<Field, number>> = {};
  for (const alias of aliases) {
    if (out[alias.field] !== undefined) continue;
    const index = folded.findIndex((header, column) => !used.has(column) && header === alias.name);
    if (index < 0) continue;
    out[alias.field] = index;
    used.add(index);
  }
  return out;
}

export function parseMarketplaceTable(table: string[][]): ParsedLine[] {
  const headers = table[0] ?? [];
  const columns = mapColumns(headers);
  if (columns.orderId === undefined) {
    throw new Error("Thiếu cột mã đơn. Cần Order ID hoặc Mã đơn hàng.");
  }
  if (columns.sku === undefined) {
    throw new Error("Thiếu cột SKU. Cần Seller SKU hoặc Mã SKU.");
  }
  const lines: ParsedLine[] = [];
  for (const row of table.slice(1)) {
    const orderId = cell(row, columns.orderId);
    const sku = cell(row, columns.sku);
    if (!orderId && !sku) continue;
    const qty = Math.round(parseMoney(cell(row, columns.qty)) ?? 0);
    lines.push({
      orderId,
      sku,
      name: cell(row, columns.name),
      qty: qty > 0 ? qty : 1,
      buyer: cell(row, columns.buyer),
      phone: cell(row, columns.phone),
      address: cell(row, columns.address),
      tracking: cell(row, columns.tracking),
      carrier: cell(row, columns.carrier),
      shipFee: columns.shipFee === undefined ? null : parseMoney(cell(row, columns.shipFee)),
      codAmount: columns.cod === undefined ? null : parseMoney(cell(row, columns.cod)),
    });
  }
  return lines;
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

export function planMarketplaceImport(input: {
  lines: ParsedLine[];
  maps: Pick<SkuMap, "externalSku" | "skuId">[];
  existingIds: string[];
}): { orders: PlannedOrder[]; issues: ImportIssue[]; duplicates: string[] } {
  const maps = new Map(input.maps.map((row) => [foldHeader(row.externalSku), row.skuId]));
  const existing = new Set(input.existingIds.map((id) => id.trim()));
  const groups = new Map<string, ParsedLine[]>();
  for (const line of input.lines) {
    if (!line.orderId) {
      continue;
    }
    const list = groups.get(line.orderId) ?? [];
    list.push(line);
    groups.set(line.orderId, list);
  }
  const orders: PlannedOrder[] = [];
  const issues: ImportIssue[] = [];
  const duplicates: string[] = [];
  for (const [orderId, lines] of groups) {
    if (existing.has(orderId)) {
      duplicates.push(orderId);
      continue;
    }
    const items: PlannedItem[] = [];
    const pending: ImportIssue[] = [];
    for (const line of lines) {
      if (!line.sku) {
        pending.push({ orderId, sku: "", name: line.name, reason: "Thiếu SKU" });
        continue;
      }
      const skuId = maps.get(foldHeader(line.sku));
      if (!skuId) {
        pending.push({ orderId, sku: line.sku, name: line.name, reason: "Chưa có bảng map SKU" });
        continue;
      }
      items.push({ skuId, quantity: line.qty, externalSku: line.sku, name: line.name });
    }
    const phone = lines.map((line) => line.phone).find((value) => value.replace(/\D/g, "").length >= 8) ?? "";
    if (!phone) pending.push({ orderId, sku: "", name: "", reason: "Thiếu số điện thoại" });
    if (pending.length || !items.length) {
      issues.push(...(pending.length ? pending : [{ orderId, sku: "", name: "", reason: "Không có dòng sản phẩm" }]));
      continue;
    }
    orders.push({
      platformOrderId: orderId,
      buyer: lines.map((line) => line.buyer).find(Boolean) || "Khách sàn",
      phone,
      address: lines.map((line) => line.address).find(Boolean) ?? "",
      carrier: lines.map((line) => line.carrier).find(Boolean) ?? "",
      tracking: lines.map((line) => line.tracking).find(Boolean) ?? "",
      shipFee: lines.find((line) => line.shipFee !== null)?.shipFee ?? null,
      codAmount: lines.find((line) => line.codAmount !== null)?.codAmount ?? null,
      status: "nhan_don",
      items,
    });
  }
  return { orders, issues, duplicates };
}
