import type { OrderStatus } from "./types.ts";

/** Đơn còn trên lịch / checklist xưởng (chưa xong / hủy). */
export const OPS_OPEN_STATUSES: OrderStatus[] = [
  "draft_upload",
  "upload_error",
  "nhan_don",
  "thiet_ke",
  "cho_duyet",
  "in",
  "dong_goi",
  "giao",
];

/** Cột công việc — pipeline in ấn. */
export const TASK_COLUMNS: { id: OrderStatus; label: string }[] = [
  { id: "nhan_don", label: "Nhận file / đơn" },
  { id: "thiet_ke", label: "Xử lý trước in" },
  { id: "cho_duyet", label: "Khách duyệt" },
  { id: "in", label: "Đang in" },
  { id: "dong_goi", label: "Đóng gói" },
  { id: "giao", label: "Chờ giao" },
];

export type OpsOrderRow = {
  id: string;
  code: string;
  status: string;
  statusLabel?: string;
  createdAt: string;
  dueDate?: string | null;
  customerName: string;
  itemSummary: string;
  late?: boolean;
  fileCount?: number;
  fulfillment?: string;
};

/** Ngày lịch: ưu tiên hẹn giao (YYYY-MM-DD), không có thì ngày tạo theo VN. */
export function opsCalendarDay(order: Pick<OpsOrderRow, "dueDate" | "createdAt">, timeZone = "Asia/Ho_Chi_Minh"): string {
  const due = order.dueDate?.trim();
  if (due && /^\d{4}-\d{2}-\d{2}/.test(due)) return due.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(order.createdAt));
}

export function opsMonthKey(day: string): string {
  return day.slice(0, 7);
}

export function opsIsOpenStatus(status: string): boolean {
  return (OPS_OPEN_STATUSES as string[]).includes(status);
}

export function groupOrdersByDay(orders: OpsOrderRow[], month: string): { day: string; orders: OpsOrderRow[] }[] {
  const buckets = new Map<string, OpsOrderRow[]>();
  for (const order of orders) {
    const day = opsCalendarDay(order);
    if (opsMonthKey(day) !== month) continue;
    const list = buckets.get(day) ?? [];
    list.push(order);
    buckets.set(day, list);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, rows]) => ({
      day,
      orders: rows.slice().sort((a, b) => a.code.localeCompare(b.code)),
    }));
}

export function groupOrdersByTaskColumn(orders: OpsOrderRow[]): { id: OrderStatus; label: string; orders: OpsOrderRow[] }[] {
  return TASK_COLUMNS.map((col) => ({
    ...col,
    orders: orders
      .filter((order) => order.status === col.id)
      .slice()
      .sort((a, b) => {
        const da = opsCalendarDay(a);
        const db = opsCalendarDay(b);
        return da.localeCompare(db) || a.code.localeCompare(b.code);
      }),
  }));
}

export function vnToday(timeZone = "Asia/Ho_Chi_Minh"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export function formatVnDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", day: "numeric", month: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}
