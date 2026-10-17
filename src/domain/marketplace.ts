import type { SkuMap } from "./types.ts";

export type MarketplaceChannel = "tiktok" | "shopee";

/**
 * Cột file xuất Seller Center. Khớp gần đúng: không phân biệt hoa thường, dấu, khoảng trắng.
 * Tên dài được ưu tiên, rồi tên nằm trong tiêu đề. API sau này trả cùng một bảng này.
 */
const FIELD_ALIASES = {
  orderId: ["order id", "order sn", "order number", "ordersn", "ma don hang", "ma don"],
  sku: [
    "sku phan loai hang",
    "sku reference no",
    "sku san pham",
    "sku reference",
    "seller sku id",
    "product sku",
    "seller sku",
    "ma sku phan loai",
    "ma sku",
  ],
  name: ["product name", "item name", "ten san pham"],
  variation: ["variation name", "ten phan loai hang", "phan loai hang", "variation"],
  qty: ["quantity", "so luong", "qty"],
  buyer: ["ten nguoi nhan", "recipient name", "customer name", "nguoi nhan", "recipient"],
  phone: ["phone number", "recipient phone", "so dien thoai", "phone", "sdt"],
  detailAddress: ["detail address", "dia chi chi tiet"],
  additionalAddress: ["additional address information", "additional address"],
  commune: ["commune", "ward", "phuong xa", "phuong", "xa"],
  district: ["districts", "district", "quan huyen"],
  city: ["thanh pho", "city"],
  province: ["tinh thanh pho", "province", "tinh"],
  country: ["country", "quoc gia"],
  address: ["dia chi nhan hang", "delivery address", "full address", "dia chi"],
  tracking: ["tracking number", "tracking id", "ma van don", "tracking"],
  carrier: [
    "shipping provider name",
    "shipping provider",
    "logistics provider",
    "don vi van chuyen",
    "shipping option",
    "hang van chuyen",
    "carrier",
  ],
  shipFee: ["shipping fee after discount", "phi van chuyen ma nguoi mua tra", "phi van chuyen", "shipping fee", "ship fee"],
  shipFeeOriginal: ["phi van chuyen du kien", "original shipping fee"],
  payment: ["phuong thuc thanh toan", "payment method", "payment"],
  buyerPaid: ["tong so tien nguoi mua thanh toan"],
  orderAmount: ["tong gia tri don hang vnd", "tong gia tri don hang", "order amount", "order total"],
  lineAmount: ["sku subtotal after discount", "tong gia ban san pham"],
  dealPrice: ["gia uu dai"],
  status: ["trang thai don hang", "order status", "status"],
  createdAt: ["created time", "ngay dat hang", "order creation date", "created at"],
  cod: ["cod amount", "tien thu ho", "cod"],
} as const;

export const EXPECTED_COLUMNS = [
  "Mã đơn (Order ID / Mã đơn hàng)",
  "SKU (Seller SKU / SKU phân loại hàng, hoặc SKU sản phẩm)",
  "Tên sản phẩm và phân loại (Variation)",
  "Số lượng",
  "Người nhận (Recipient / Tên Người nhận). Không lấy Buyer Username",
  "Số điện thoại, kể cả số bị che",
  "Địa chỉ: cột Địa chỉ nhận hàng nếu có; không thì Detail Address, phường/xã, quận, tỉnh. Quốc gia để cuối",
  "Đơn vị vận chuyển (Shipping Provider Name / Đơn Vị Vận Chuyển)",
  "Mã vận đơn (Tracking ID / Mã vận đơn)",
  "Phí vận chuyển người mua trả, không có thì phí sau giảm hoặc phí dự kiến",
  "Phương thức thanh toán. COD (khi giao hoặc khi nhận) thì tiền thu hộ bằng số người mua trả",
  "Tổng đơn: Tổng số tiền người mua thanh toán, không có thì Order Amount",
  "Tiền từng dòng: SKU Subtotal After Discount hoặc Tổng giá bán (sản phẩm), không có thì Giá ưu đãi × số lượng",
  "Trạng thái. Đơn Đã hủy / Cancelled bị bỏ qua",
  "Thời gian tạo (Created Time)",
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
  variation: string;
  qty: number;
  buyer: string;
  phone: string;
  address: string;
  tracking: string;
  carrier: string;
  shipFee: number | null;
  codAmount: number | null;
  payment: string;
  orderAmount: number | null;
  lineAmount: number | null;
  status: string;
  createdAt: string | null;
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
  /** Tiền dòng trên sàn. Null khi file không có tiền từng dòng. */
  platformLineTotal: number | null;
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
  orderAmount: number | null;
  flags: string[];
  createdAt: string | null;
  status: "nhan_don";
  items: PlannedItem[];
};

const PHONE_HIDDEN = "SĐT bị ẩn";
const LINE_AMOUNT_MISSING = "Không có tiền từng dòng";

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

/** Số che sao giữ nguyên. Số đủ thì đổi 84/+84 về đầu 0. */
export function normalizeMarketplacePhone(raw: string): { phone: string; masked: boolean } {
  const text = raw.trim();
  if (!text) return { phone: "", masked: false };
  if (/[*•＊]/.test(text)) return { phone: text, masked: true };
  const digits = text.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 10) return { phone: `0${digits.slice(2)}`, masked: false };
  return { phone: digits, masked: false };
}

export function isCancelledStatus(status: string): boolean {
  const folded = foldHeader(status);
  if (!folded) return false;
  return folded === "cancelled" || folded === "canceled" || folded === "da huy" || folded.includes("cancelled") || folded.includes("canceled") || /\bda huy\b/.test(folded);
}

export function isCodPayment(payment: string): boolean {
  const folded = foldHeader(payment);
  if (!folded) return false;
  if (folded === "cod" || folded.split(" ").includes("cod")) return true;
  return folded.includes("cash on delivery") || folded.includes("thanh toan khi giao hang") || folded.includes("thanh toan khi nhan hang");
}

/** Giờ Việt Nam (UTC+7) từ Created Time. Không đọc được thì null. */
export function parseCreatedTime(raw: string): string | null {
  const text = raw.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  const parts = iso
    ? { y: Number(iso[1]), mo: Number(iso[2]), d: Number(iso[3]), hh: Number(iso[4] ?? 0), mm: Number(iso[5] ?? 0), ss: Number(iso[6] ?? 0) }
    : dmy
      ? { y: Number(dmy[3]), mo: Number(dmy[2]), d: Number(dmy[1]), hh: Number(dmy[4] ?? 0), mm: Number(dmy[5] ?? 0), ss: Number(dmy[6] ?? 0) }
      : null;
  if (!parts) return null;
  if (parts.mo < 1 || parts.mo > 12 || parts.d < 1 || parts.d > 31 || parts.hh > 23 || parts.mm > 59 || parts.ss > 59) return null;
  const stamp = new Date(Date.UTC(parts.y, parts.mo - 1, parts.d, parts.hh - 7, parts.mm, parts.ss));
  if (Number.isNaN(stamp.getTime())) return null;
  const check = new Date(stamp.getTime() + 7 * 60 * 60 * 1000);
  if (check.getUTCFullYear() !== parts.y || check.getUTCMonth() + 1 !== parts.mo || check.getUTCDate() !== parts.d) return null;
  return stamp.toISOString();
}

export function listDifference(platformLineTotal: number | null, listUnitPrice: number | null, quantity: number): number | null {
  if (platformLineTotal === null || listUnitPrice === null) return null;
  return platformLineTotal - listUnitPrice * quantity;
}

/** Mã đơn sàn: có chữ số, không có câu mô tả. */
export function looksLikeOrderId(value: string): boolean {
  const text = value.trim();
  if (!text || text.length > 40 || /\s/.test(text) || !/\d/.test(text)) return false;
  if (text.endsWith(".") || /[a-z]\.[a-z]/i.test(text)) return false;
  return true;
}

type Field = keyof typeof FIELD_ALIASES;
type ColumnMap = Partial<Record<Field, number>>;

const ALIASES: { field: Field; name: string }[] = (Object.entries(FIELD_ALIASES) as [Field, readonly string[]][])
  .flatMap(([field, names]) => names.map((name) => ({ field, name: foldHeader(name) })))
  .sort((a, b) => b.name.length - a.name.length);

function containsAlias(header: string, alias: string): boolean {
  if (alias.length < 4) return false;
  if (` ${header} `.includes(` ${alias} `)) return true;
  if (alias.includes(" ")) return false;
  return header.split(" ").some((word) => word.startsWith(alias) && word.length - alias.length <= 2 && word !== alias);
}

export function mapColumns(headers: string[]): ColumnMap {
  return mapColumnsScored(headers).columns;
}

function mapColumnsScored(headers: string[]): { columns: ColumnMap; score: number } {
  const folded = headers.map((header) => foldHeader(header));
  const used = new Set<number>();
  const columns: ColumnMap = {};
  let score = 0;
  for (const alias of ALIASES) {
    if (columns[alias.field] !== undefined) continue;
    const index = folded.findIndex((header, column) => !used.has(column) && header === alias.name);
    if (index < 0) continue;
    columns[alias.field] = index;
    used.add(index);
    score += 5;
  }
  for (const alias of ALIASES) {
    if (columns[alias.field] !== undefined) continue;
    const index = folded.findIndex((header, column) => !used.has(column) && containsAlias(header, alias.name));
    if (index < 0) continue;
    columns[alias.field] = index;
    used.add(index);
    score += 1;
  }
  return { columns, score };
}

function headerRowIndex(table: string[][]): number {
  const limit = Math.min(table.length, 5);
  let best = 0;
  let bestScore = -1;
  for (let index = 0; index < limit; index++) {
    const score = mapColumnsScored(table[index] ?? []).score;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  return best;
}

export function parseMarketplaceTable(table: string[][]): ParsedLine[] {
  const headerAt = headerRowIndex(table);
  const columns = mapColumns(table[headerAt] ?? []);
  if (columns.orderId === undefined) {
    throw new Error("Thiếu cột mã đơn. Cần Order ID hoặc Mã đơn hàng.");
  }
  if (columns.sku === undefined) {
    throw new Error("Thiếu cột SKU. Cần Seller SKU, SKU phân loại hàng hoặc Mã SKU.");
  }
  const lines: ParsedLine[] = [];
  for (const row of table.slice(headerAt + 1)) {
    const orderId = cell(row, columns.orderId);
    const sku = cell(row, columns.sku);
    if (!orderId && !sku) continue;
    if (!looksLikeOrderId(orderId)) continue;
    const qty = Math.round(parseMoney(cell(row, columns.qty)) ?? 0);
    const quantity = qty > 0 ? qty : 1;
    const discounted = columns.shipFee === undefined ? null : parseMoney(cell(row, columns.shipFee));
    const original = columns.shipFeeOriginal === undefined ? null : parseMoney(cell(row, columns.shipFeeOriginal));
    const paid = columns.buyerPaid === undefined ? null : parseMoney(cell(row, columns.buyerPaid));
    const goods = columns.orderAmount === undefined ? null : parseMoney(cell(row, columns.orderAmount));
    let lineAmount = columns.lineAmount === undefined ? null : parseMoney(cell(row, columns.lineAmount));
    if (lineAmount === null && columns.dealPrice !== undefined) {
      const unit = parseMoney(cell(row, columns.dealPrice));
      if (unit !== null) lineAmount = unit * quantity;
    }
    lines.push({
      orderId,
      sku,
      name: cell(row, columns.name),
      variation: cell(row, columns.variation),
      qty: quantity,
      buyer: cell(row, columns.buyer),
      phone: cell(row, columns.phone),
      address: joinedAddress(row, columns),
      tracking: cell(row, columns.tracking),
      carrier: cell(row, columns.carrier),
      shipFee: discounted ?? original,
      codAmount: columns.cod === undefined ? null : parseMoney(cell(row, columns.cod)),
      payment: cell(row, columns.payment),
      orderAmount: paid ?? goods,
      lineAmount,
      status: cell(row, columns.status),
      createdAt: parseCreatedTime(cell(row, columns.createdAt)),
    });
  }
  return lines;
}

const ADDRESS_PARTS: Field[] = ["detailAddress", "additionalAddress", "commune", "district", "city", "province", "country"];

function joinedAddress(row: string[], columns: ColumnMap): string {
  const full = cell(row, columns.address);
  if (full) {
    const country = cell(row, columns.country);
    if (country && !full.toLowerCase().includes(country.toLowerCase())) return `${full}, ${country}`;
    return full;
  }
  const parts: string[] = [];
  for (const field of ADDRESS_PARTS) {
    const value = cell(row, columns[field]);
    if (value && !parts.includes(value)) parts.push(value);
  }
  return parts.join(", ");
}

function cell(row: string[], index: number | undefined): string {
  if (index === undefined) return "";
  return (row[index] ?? "").trim();
}

export function planMarketplaceImport(input: {
  lines: ParsedLine[];
  maps: Pick<SkuMap, "externalSku" | "skuId">[];
  existingIds: string[];
}): { orders: PlannedOrder[]; issues: ImportIssue[]; duplicates: string[]; cancelled: number } {
  const maps = new Map(input.maps.map((row) => [foldHeader(row.externalSku), row.skuId]));
  const existing = new Set(input.existingIds.map((id) => id.trim()));
  const groups = new Map<string, ParsedLine[]>();
  for (const line of input.lines) {
    if (!line.orderId) continue;
    const list = groups.get(line.orderId) ?? [];
    list.push(line);
    groups.set(line.orderId, list);
  }
  const orders: PlannedOrder[] = [];
  const issues: ImportIssue[] = [];
  const duplicates: string[] = [];
  let cancelled = 0;
  for (const [orderId, lines] of groups) {
    if (lines.some((line) => isCancelledStatus(line.status))) {
      cancelled += 1;
      continue;
    }
    if (existing.has(orderId)) {
      duplicates.push(orderId);
      continue;
    }
    const items: PlannedItem[] = [];
    const pending: ImportIssue[] = [];
    for (const line of lines) {
      const name = [line.name, line.variation].filter(Boolean).join(" — ");
      if (!line.sku) {
        pending.push({ orderId, sku: "", name, reason: "Thiếu SKU" });
        continue;
      }
      const skuId = maps.get(foldHeader(line.sku));
      if (!skuId) {
        pending.push({ orderId, sku: line.sku, name, reason: "Chưa có bảng map SKU" });
        continue;
      }
      items.push({ skuId, quantity: line.qty, externalSku: line.sku, name, platformLineTotal: line.lineAmount });
    }
    const phone = normalizeMarketplacePhone(lines.map((line) => line.phone).find((value) => value.trim()) ?? "");
    const flags: string[] = [];
    if (phone.masked) flags.push(PHONE_HIDDEN);
    else if (phone.phone.length < 8) pending.push({ orderId, sku: "", name: "", reason: "Thiếu số điện thoại" });
    if (pending.length || !items.length) {
      issues.push(...(pending.length ? pending : [{ orderId, sku: "", name: "", reason: "Không có dòng sản phẩm" }]));
      continue;
    }
    const orderAmount = lines.find((line) => line.orderAmount !== null)?.orderAmount ?? null;
    if (items.length === 1 && items[0]!.platformLineTotal === null && orderAmount !== null) {
      items[0]!.platformLineTotal = orderAmount;
    }
    if (items.length > 1 && items.some((item) => item.platformLineTotal === null)) flags.push(LINE_AMOUNT_MISSING);
    const payment = lines.map((line) => line.payment).find((value) => value.trim()) ?? "";
    const explicitCod = lines.find((line) => line.codAmount !== null)?.codAmount ?? null;
    orders.push({
      platformOrderId: orderId,
      buyer: lines.map((line) => line.buyer).find((value) => value.trim()) || "Khách sàn",
      phone: phone.phone,
      address: lines.map((line) => line.address).find((value) => value.trim()) ?? "",
      carrier: lines.map((line) => line.carrier).find((value) => value.trim()) ?? "",
      tracking: lines.map((line) => line.tracking).find((value) => value.trim()) ?? "",
      shipFee: lines.find((line) => line.shipFee !== null)?.shipFee ?? null,
      codAmount: isCodPayment(payment) ? (orderAmount ?? explicitCod) : explicitCod,
      orderAmount,
      flags,
      createdAt: lines.find((line) => line.createdAt)?.createdAt ?? null,
      status: "nhan_don",
      items,
    });
  }
  return { orders, issues, duplicates, cancelled };
}
