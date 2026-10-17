import { vnParts } from "./calc.ts";
import type { Customer, Order, OrderStatus, ShopState } from "./types.ts";
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
};

export type CustomerReminder = CustomerCard & {
  reasons: string[];
  message: string;
};

const SKIPPED: OrderStatus[] = ["draft_upload", "upload_error", "huy"];

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
  const groups = new Map<string, Customer[]>();
  for (const customer of state.customers) {
    const key = groupKey(customer);
    const list = groups.get(key) ?? [];
    list.push(customer);
    groups.set(key, list);
  }
  const cards: CustomerCard[] = [];
  for (const people of groups.values()) {
    const ids = new Set(people.map((person) => person.id));
    const orders = state.orders.filter((order) => ids.has(order.customerId) && !SKIPPED.includes(order.status));
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

function groupKey(customer: Customer): string {
  const phone = customer.phoneNormalized.trim();
  if (!phone || phone === "masked:") return `id:${customer.id}`;
  return phone;
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
    .filter((order) => ids.has(order.customerId) && !SKIPPED.includes(order.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
