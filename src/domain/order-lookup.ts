import { remainOf } from "./money.ts";
import { uploadTokenShape } from "./order-upload.ts";

export type LookupOrder = {
  code: string;
  customerId: string;
  status: string;
  createdAt: string;
  total: number | null;
  depositPaid: number;
  fulfillment: string;
  address: string;
  customerNote: string;
  channel?: string;
  accessToken?: string;
  shipping?: { carrier?: string; tracking?: string; carrierStatus?: string } | null;
  items: { name: string; skuCode: string; quantity: number; lineTotal: number | null }[];
  files: {
    id?: string;
    name?: string;
    kind?: string;
    status?: string;
    createdAt?: string;
    deletedAt?: string | null;
    print?: boolean;
  }[];
  history: { to: string; at: string; note: string }[];
};

export type PublicLookupPhoto = { id: string; name: string; createdAt: string; print: boolean };

export type PublicLookupOrder = {
  code: string;
  status: string;
  createdAt: string;
  total: number | null;
  depositPaid: number;
  remain: number | null;
  fulfillment: string;
  address: string | null;
  note: string | null;
  channel: string | null;
  customerName: string;
  items: { name: string; variant: string; quantity: number; lineTotal: number | null }[];
  fileCount: number;
  /** Token xem ảnh gốc — chỉ trả sau khi khớp SĐT. */
  photoToken: string | null;
  photos: PublicLookupPhoto[];
  shipping: { carrier: string; tracking: string; carrierStatus: string } | null;
  history: { to: string; at: string; note: string }[];
};

export type PhoneLookup = {
  customerName: string;
  focus: string;
  orders: PublicLookupOrder[];
};

const HISTORY_CAP = 50;
const PHOTO_CAP = 60;

/** Cùng quy tắc với số lưu trên khách: 84… dài thành 0…. */
export function lookupPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 10) return `0${digits.slice(2)}`;
  return digits;
}

function shippingOf(order: LookupOrder): PublicLookupOrder["shipping"] {
  const ship = order.shipping;
  const carrier = ship?.carrier?.trim() || "";
  const tracking = ship?.tracking?.trim() || "";
  const carrierStatus = ship?.carrierStatus?.trim() || "";
  return carrier || tracking || carrierStatus ? { carrier, tracking, carrierStatus } : null;
}

function photosOf(order: LookupOrder): PublicLookupPhoto[] {
  return order.files
    .filter((file) => file.id && file.kind === "original" && file.status === "complete" && !file.deletedAt)
    .sort((a, b) => {
      const left = a.createdAt ?? "";
      const right = b.createdAt ?? "";
      return left < right ? 1 : left > right ? -1 : (b.id ?? "").localeCompare(a.id ?? "");
    })
    .slice(0, PHOTO_CAP)
    .map((file) => ({
      id: file.id!,
      name: file.name || "Ảnh",
      createdAt: file.createdAt || order.createdAt,
      print: file.print === true,
    }));
}

export function lookupByPhone(input: {
  phone: string;
  code?: string;
  customers: { id: string; name: string; phoneNormalized: string }[];
  orders: LookupOrder[];
}): PhoneLookup {
  const phone = lookupPhoneDigits(input.phone);
  if (phone.length < 8) throw new Error("Số điện thoại chưa đúng.");
  const names = new Map(input.customers.filter((customer) => customer.phoneNormalized === phone).map((customer) => [customer.id, customer.name]));
  if (!names.size) throw new Error("Không thấy đơn nào với số điện thoại này.");
  const code = (input.code ?? "").trim().toUpperCase();
  const matched = input.orders
    .filter((order) => names.has(order.customerId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.code.localeCompare(a.code)));
  if (!matched.length) throw new Error("Không thấy đơn nào với số điện thoại này.");
  if (code && !matched.some((order) => order.code.toUpperCase() === code)) {
    throw new Error("Không tìm thấy đơn hàng khớp mã đơn và số điện thoại.");
  }
  const orders = matched.slice(0, HISTORY_CAP).map((order) => {
    const photos = photosOf(order);
    const token = order.accessToken && uploadTokenShape(order.accessToken) ? order.accessToken : null;
    return {
      code: order.code,
      status: order.status,
      createdAt: order.createdAt,
      total: order.total,
      depositPaid: order.depositPaid ?? 0,
      remain: remainOf({ total: order.total, depositPaid: order.depositPaid ?? 0 }),
      fulfillment: order.fulfillment,
      address: order.address || null,
      note: order.customerNote || null,
      channel: order.channel || null,
      customerName: names.get(order.customerId) || "Khách",
      items: order.items.map((item) => ({
        name: item.name,
        variant: item.skuCode,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      fileCount: photos.length,
      photoToken: token,
      photos: token ? photos : [],
      shipping: shippingOf(order),
      history: order.history.map((item) => ({ to: item.to, at: item.at, note: item.note })),
    };
  });
  const unique = [...new Set(orders.map((order) => order.customerName))];
  return {
    customerName: unique.length === 1 ? unique[0]! : "Khách",
    focus: code && orders.some((order) => order.code.toUpperCase() === code) ? orders.find((order) => order.code.toUpperCase() === code)!.code : orders[0]!.code,
    orders,
  };
}
