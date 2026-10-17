import { vnParts } from "./calc.ts";
import type { Customer, Order, ShopState } from "./types.ts";
import { CHANNEL_LABEL } from "./types.ts";

export const DEFAULT_REPEAT_ORDERS = 2;
export const DEFAULT_REMIND_DAYS = 60;
export const DEFAULT_DATE_LEAD_DAYS = 7;
export const DEFAULT_REMIND_MESSAGE =
  "Chào {ten}, Nhà In Thiên Thiên nhắc anh/chị. {dip}Lần in gần nhất cách đây {ngay} ngày, hiện có {so_don} đơn. Cần in thêm thì nhắn lại giúp em.";

export type SpecialDate = { label: string; month: number; day: number };

export type CustomerCard = {
  id: string;
  ids: string[];
  name: string;
  phone: string;
  phoneNormalized: string;
  address: string;
  note: string;
  tags: string[];
  specialDates: SpecialDate[];
  orderCount: number;
  totalSpent: number | null;
  spentIncomplete: boolean;
  channels: string[];
  repeat: boolean;
  lastOrderAt: string | null;
  daysSinceOrder: number | null;
  addresses: string[];
  platformBuyers: string[];
  /** Mọi đơn thật đều đã hủy. Danh sách mặc định ẩn các khách này. */
  onlyCancelled: boolean;
};

export type CustomerReminder = CustomerCard & {
  reasons: string[];
  message: string;
};

export function renderRemindMessage(
  template: string,
  fields: { ten: string; so_don: number; ngay: number | null; dip: string; so_dt: string },
): string {
  return template
    .replaceAll("{ten}", fields.ten)
    .replaceAll("{so_don}", String(fields.so_don))
    .replaceAll("{ngay}", fields.ngay === null ? "—" : String(fields.ngay))
    .replaceAll("{dip}", fields.dip)
    .replaceAll("{so_dt}", fields.so_dt);
}

export function customerCards(state: ShopState, now = new Date()): CustomerCard[] {
  const repeatAt = state.settings.repeatCustomerOrders ?? DEFAULT_REPEAT_ORDERS;
  const cards: CustomerCard[] = [];
  for (const people of groupCustomers(state.customers)) {
    const ids = new Set(people.map((person) => person.id));
    const linked = state.orders.filter((order) => ids.has(order.customerId));
    const real = linked.filter((order) => order.status !== "draft_upload" && order.status !== "upload_error");
    const orders = real.filter((order) => order.status !== "huy");
    const primary = [...people].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0]!;
    const latest = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const latestPerson = latest ? people.find((person) => person.id === latest.customerId) : undefined;
    const named = latestPerson?.name.trim() ? latestPerson : (people.find((person) => person.name.trim()) ?? primary);
    const spent = orders.map((order) => order.total);
    const known = spent.filter((value): value is number => value !== null);
    const lastOrderAt = latest?.createdAt ?? null;
    const daysSinceOrder = lastOrderAt ? daysBetween(vnParts(new Date(lastOrderAt)).ymd, vnParts(now).ymd) : null;
    cards.push({
      id: primary.id,
      ids: people.map((person) => person.id),
      name: named.name,
      phone: (latestPerson?.phone || named.phone || primary.phone),
      phoneNormalized: primary.phoneNormalized,
      address: people.map((person) => person.address).find((value) => value.trim()) ?? "",
      note: uniqueJoin(people.map((person) => person.note)),
      tags: unique(people.flatMap((person) => person.tags ?? [])),
      specialDates: uniqueDates(people.flatMap((person) => person.specialDates ?? [])),
      orderCount: orders.length,
      totalSpent: known.length ? known.reduce((sum, value) => sum + value, 0) : null,
      spentIncomplete: spent.some((value) => value === null),
      channels: unique(orders.map((order) => CHANNEL_LABEL[order.channel])),
      repeat: orders.length >= repeatAt,
      lastOrderAt,
      daysSinceOrder,
      addresses: unique(people.flatMap((person) => [person.address, ...(person.addresses ?? [])])),
      platformBuyers: unique(people.map((person) => person.platformBuyer ?? "")),
      onlyCancelled: real.length > 0 && real.every((order) => order.status === "huy"),
    });
  }
  return cards.sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export function customerCard(state: ShopState, id: string, now = new Date()): CustomerCard | null {
  return customerCards(state, now).find((card) => card.ids.includes(id)) ?? null;
}

export function customerReminders(state: ShopState, now = new Date()): CustomerReminder[] {
  const after = state.settings.remindAfterDays ?? DEFAULT_REMIND_DAYS;
  const template = state.settings.remindMessage?.trim() || DEFAULT_REMIND_MESSAGE;
  const today = vnParts(now).ymd;
  const reminders: CustomerReminder[] = [];
  for (const card of customerCards(state, now)) {
    if (card.onlyCancelled) continue;
    const reasons: string[] = [];
    const dips: string[] = [];
    if (card.daysSinceOrder !== null && card.daysSinceOrder >= after) {
      reasons.push(`Đơn cuối cách đây ${card.daysSinceOrder} ngày`);
    }
    for (const date of card.specialDates) {
      const lead = daysUntil(date.month, date.day, today);
      if (lead === null || lead > DEFAULT_DATE_LEAD_DAYS) continue;
      const when = lead === 0 ? "hôm nay" : `còn ${lead} ngày`;
      reasons.push(`${date.label} ${when}`);
      dips.push(`${date.label} (${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}) ${when}. `);
    }
    if (!reasons.length) continue;
    reminders.push({
      ...card,
      reasons,
      message: renderRemindMessage(template, {
        ten: card.name || "anh/chị",
        so_don: card.orderCount,
        ngay: card.daysSinceOrder,
        dip: dips.join(""),
        so_dt: card.phone,
      }),
    });
  }
  return reminders;
}

/**
 * Khóa được phép gộp. Số bị che không bao giờ là khóa.
 * Khách số che chỉ gộp khi cùng tài khoản sàn, hoặc trùng cả tên và địa chỉ.
 * Không có khóa nào thì mỗi khách một nhóm.
 */
export function groupKey(customer: Customer): string[] {
  const phone = customer.phoneNormalized.trim();
  if (phone && !phone.startsWith("masked:")) return [`phone:${phone}`];
  const keys: string[] = [];
  const buyer = (customer.platformBuyer ?? "").trim().toLowerCase();
  if (buyer) keys.push(`buyer:${buyer}`);
  const name = customer.name.trim();
  for (const place of unique([customer.address, ...(customer.addresses ?? [])])) {
    if (name) keys.push(`na:${name}\n${place}`);
  }
  return keys.length ? keys : [`id:${customer.id}`];
}

export function findCustomer(
  customers: Customer[],
  input: { phoneNormalized: string; name: string; address: string; platformBuyer?: string },
): Customer | undefined {
  const probe: Customer = {
    id: "probe",
    name: input.name,
    phone: "",
    phoneNormalized: input.phoneNormalized,
    address: input.address,
    note: "",
    createdAt: "",
    platformBuyer: input.platformBuyer?.trim() || undefined,
  };
  const keys = new Set(groupKey(probe).filter((key) => !key.startsWith("id:")));
  if (!keys.size) return undefined;
  return customers
    .filter((customer) => groupKey(customer).some((key) => keys.has(key)))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
}

/** File sàn không ghi đè tên và địa chỉ đã có. Địa chỉ mới được thêm vào danh sách. */
export function applyMarketplaceProfile(
  customer: Customer,
  input: { name: string; address: string; platformBuyer: string; masked: boolean },
): Customer {
  const addresses = unique([customer.address, ...(customer.addresses ?? []), input.address]);
  const note =
    input.masked && !customer.note.includes("SĐT bị ẩn")
      ? [customer.note, "SĐT bị ẩn"].filter(Boolean).join(". ")
      : customer.note;
  return {
    ...customer,
    name: customer.name.trim() ? customer.name : input.name.trim(),
    address: customer.address.trim() ? customer.address.trim() : input.address.trim(),
    addresses,
    platformBuyer: customer.platformBuyer?.trim() || input.platformBuyer.trim() || undefined,
    note,
  };
}

function groupCustomers(customers: Customer[]): Customer[][] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const next = parent.get(id) ?? id;
    if (next === id) return id;
    const root = find(next);
    parent.set(id, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(a, b);
  };
  const seen = new Map<string, string>();
  for (const customer of customers) {
    parent.set(customer.id, customer.id);
    for (const key of groupKey(customer)) {
      const hit = seen.get(key);
      if (hit) union(hit, customer.id);
      else seen.set(key, customer.id);
    }
  }
  const groups = new Map<string, Customer[]>();
  for (const customer of customers) {
    const root = find(customer.id);
    const list = groups.get(root) ?? [];
    list.push(customer);
    groups.set(root, list);
  }
  return [...groups.values()];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueJoin(values: string[]): string {
  return unique(values).join("\n");
}

function uniqueDates(dates: SpecialDate[]): SpecialDate[] {
  const seen = new Set<string>();
  const out: SpecialDate[] = [];
  for (const date of dates) {
    const key = `${date.label.trim()}|${date.month}|${date.day}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: date.label.trim(), month: date.month, day: date.day });
  }
  return out;
}

function daysBetween(earlier: string, later: string): number {
  const start = Date.parse(`${earlier}T00:00:00Z`);
  const end = Date.parse(`${later}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function daysUntil(month: number, day: number, todayYmd: string): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const [year, todayMonth, todayDay] = todayYmd.split("-").map(Number);
  const today = Date.UTC(year!, todayMonth! - 1, todayDay);
  let targetYear = year!;
  let target = Date.UTC(targetYear, month - 1, day);
  const check = new Date(target);
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  if (target < today) {
    targetYear += 1;
    target = Date.UTC(targetYear, month - 1, day);
    const next = new Date(target);
    if (next.getUTCMonth() + 1 !== month || next.getUTCDate() !== day) return null;
  }
  return Math.round((target - today) / 86_400_000);
}

export function ordersForCustomer(state: ShopState, id: string): Order[] {
  const card = customerCard(state, id);
  if (!card) return [];
  const ids = new Set(card.ids);
  return state.orders
    .filter((order) => ids.has(order.customerId) && order.status !== "draft_upload" && order.status !== "upload_error")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
