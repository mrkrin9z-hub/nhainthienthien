import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatVnDay,
  groupOrdersByDay,
  opsCalendarDay,
  opsIsOpenStatus,
  opsMonthKey,
  shiftMonth,
  vnToday,
  type OpsOrderRow,
} from "@/domain/ops-desk";
import { statusLabelOf } from "@/lib/display-labels";
import { getOrders } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/lich")({
  component: CalendarPage,
});

function MonthGrid({
  month,
  today,
  days,
}: {
  month: string;
  today: string;
  days: { day: string; orders: { id: string; code: string; customerName: string; status: string }[] }[];
}) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year ?? 2026, (monthNumber ?? 1) - 1, 1));
  const pad = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year ?? 2026, monthNumber ?? 1, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(pad).fill(null)];
  for (let day = 1; day <= count; day += 1) cells.push(`${month}-${String(day).padStart(2, "0")}`);
  const byDay = new Map(days.map((bucket) => [bucket.day, bucket.orders]));
  const headers = ["Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7", "CN"];
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {headers.map((label) => (
          <div key={label} className={`px-1 py-2 ${label === "CN" ? "text-rose-600" : ""}`}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const orders = day ? byDay.get(day) ?? [] : [];
          const isToday = day === today;
          return (
            <div key={day ?? `empty-${index}`} className="min-h-20 border-t border-r p-1.5">
              {day ? (
                <>
                  <span className={`inline-flex size-6 items-center justify-center rounded-full text-[12px] font-semibold ${isToday ? "bg-[#2563eb] text-white" : ""}`}>
                    {Number(day.slice(-2))}
                  </span>
                  <ul className="mt-1 space-y-1">
                    {orders.slice(0, 3).map((order) => (
                      <li key={order.id}>
                        <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="block truncate rounded-full bg-[#e0eefe] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">
                          {order.code}
                        </Link>
                      </li>
                    ))}
                    {orders.length > 3 ? <li className="text-[10px] text-muted-foreground">+{orders.length - 3} đơn khác</li> : null}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CalendarPage() {
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const today = vnToday();
  const [month, setMonth] = useState(() => opsMonthKey(today));
  const [openOnly, setOpenOnly] = useState(true);

  const rows = useMemo(() => {
    const list = (orders.data?.orders ?? []) as OpsOrderRow[];
    return openOnly ? list.filter((order) => opsIsOpenStatus(order.status)) : list;
  }, [orders.data, openOnly]);

  const days = useMemo(() => groupOrdersByDay(rows, month), [rows, month]);
  const withDue = rows.filter((order) => order.dueDate?.trim()).length;
  const overdue = rows.filter((order) => {
    if (!opsIsOpenStatus(order.status)) return false;
    const day = opsCalendarDay(order);
    return Boolean(order.dueDate?.trim()) && day < today;
  }).length;

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Lịch nhận / hẹn in"
        hint="Theo ngày hẹn giao trên đơn. Đơn chưa chốt hẹn xếp theo ngày tạo. Bấm mã để mở đơn."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Tháng trước" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-28 text-center text-sm font-semibold tabular-nums">{month}</p>
        <Button type="button" variant="outline" size="icon" className="size-10" aria-label="Tháng sau" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRight className="size-4" />
        </Button>
        <Button type="button" variant="secondary" className="min-h-10" onClick={() => setMonth(opsMonthKey(today))}>
          Tháng này
        </Button>
        <Button
          type="button"
          variant={openOnly ? "default" : "outline"}
          className="min-h-10"
          onClick={() => setOpenOnly((v) => !v)}
        >
          {openOnly ? "Chỉ đơn đang làm" : "Cả đơn đã xong"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {withDue} đơn có hẹn giao
          {overdue ? ` · ${overdue} trễ hẹn` : ""}
        </p>
      </div>

      {orders.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {orders.isError ? <p className="font-semibold text-destructive">{(orders.error as Error).message}</p> : null}

      {!orders.isLoading && days.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Tháng này chưa có đơn trên lịch. Ghi <strong>Hẹn giao</strong> khi tạo/sửa đơn để hiện đúng ngày.
        </p>
      ) : null}

      <MonthGrid month={month} today={today} days={days} />

      <div className="space-y-3">
        {days.map((bucket) => {
          const isToday = bucket.day === today;
          const isPast = bucket.day < today;
          return (
            <section key={bucket.day} className={`rounded-2xl border bg-card p-4 ${isToday ? "border-primary/50" : ""}`}>
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-bold">
                  {formatVnDay(bucket.day)}
                  {isToday ? <span className="ml-2 text-xs font-semibold text-primary">Hôm nay</span> : null}
                </h2>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {bucket.day} · {bucket.orders.length} đơn
                </p>
              </header>
              <ul className="space-y-2">
                {bucket.orders.map((order) => {
                  const hasDue = Boolean(order.dueDate?.trim());
                  const lateDue = hasDue && isPast && opsIsOpenStatus(order.status);
                  return (
                    <li key={order.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                      <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="font-mono text-xs font-semibold text-primary">
                        {order.code}
                      </Link>
                      <span className="font-medium">{order.customerName}</span>
                      <Badge variant="secondary">{statusLabelOf(order.status, order.statusLabel)}</Badge>
                      {lateDue ? <Badge variant="destructive">Trễ hẹn</Badge> : null}
                      {!hasDue ? <span className="text-xs text-muted-foreground">Chưa chốt hẹn</span> : null}
                      {order.late ? <Badge variant="outline">Trễ sàn</Badge> : null}
                      <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">{order.itemSummary}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
