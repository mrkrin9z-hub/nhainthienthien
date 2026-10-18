export type LookupOrder = {
  code: string;
  customerId: string;
  status: string;
  createdAt: string;
  total: number | null;
  fulfillment: string;
  address: string;
  customerNote: string;
  items: { name: string; skuCode: string; quantity: number; lineTotal: number | null }[];
  files: { deletedAt?: string | null }[];
  history: { to: string; at: string; note: string }[];
};

export type PublicLookupOrder = {
  code: string;
  status: string;
  createdAt: string;
  total: number | null;
  fulfillment: string;
  address: string | null;
  note: string | null;
  customerName: string;
  items: { name: string; variant: string; quantity: number; lineTotal: number | null }[];
  fileCount: number;
  history: { to: string; at: string; note: string }[];
};

export type PhoneLookup = {
  customerName: string;
  focus: string;
  orders: PublicLookupOrder[];
};

const HISTORY_CAP = 50;

/** Cùng quy tắc với số lưu trên khách: 84… dài thành 0…. */
export function lookupPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 10) return `0${digits.slice(2)}`;
  return digits;
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
  const orders = matched.slice(0, HISTORY_CAP).map((order) => ({
    code: order.code,
    status: order.status,
    createdAt: order.createdAt,
    total: order.total,
    fulfillment: order.fulfillment,
    address: order.address || null,
    note: order.customerNote || null,
    customerName: names.get(order.customerId) || "Khách",
    items: order.items.map((item) => ({
      name: item.name,
      variant: item.skuCode,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    fileCount: order.files.filter((file) => !file.deletedAt).length,
    history: order.history.map((item) => ({ to: item.to, at: item.at, note: item.note })),
  }));
  const unique = [...new Set(orders.map((order) => order.customerName))];
  return {
    customerName: unique.length === 1 ? unique[0]! : "Khách",
    focus: code && orders.some((order) => order.code.toUpperCase() === code) ? orders.find((order) => order.code.toUpperCase() === code)!.code : orders[0]!.code,
    orders,
  };
}
