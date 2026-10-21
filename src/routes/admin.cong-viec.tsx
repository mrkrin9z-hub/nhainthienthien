import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { Badge } from "@/components/ui/badge";
import { groupOrdersByTaskColumn, opsCalendarDay, opsIsOpenStatus, vnToday, type OpsOrderRow } from "@/domain/ops-desk";
import { statusLabelOf } from "@/lib/display-labels";
import { getOrders } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/cong-viec")({
  component: TasksPage,
});

function TasksPage() {
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const [q, setQ] = useState("");
  const today = vnToday();

  const open = useMemo(() => {
    const list = (orders.data?.orders ?? []) as OpsOrderRow[];
    const needle = q.trim().toLowerCase();
    return list.filter((order) => {
      if (!opsIsOpenStatus(order.status)) return false;
      if (!needle) return true;
      return `${order.code} ${order.customerName} ${order.itemSummary}`.toLowerCase().includes(needle);
    });
  }, [orders.data, q]);

  const columns = useMemo(() => groupOrdersByTaskColumn(open), [open]);
  const total = columns.reduce((sum, col) => sum + col.orders.length, 0);
  const uploadIssues = open.filter((order) => order.status === "draft_upload" || order.status === "upload_error");

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Công việc xưởng"
        hint="Checklist theo bước: nhận file → xử lý → in → đóng gói → giao. Bấm mã để cập nhật trạng thái trên đơn."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã, khách, hàng…"
      />

      <p className="text-sm text-muted-foreground">
        {total} việc đang mở
        {uploadIssues.length ? ` · ${uploadIssues.length} đơn ảnh chưa ổn (xem Đơn hàng / Album)` : ""}
      </p>

      {orders.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {orders.isError ? <p className="font-semibold text-destructive">{(orders.error as Error).message}</p> : null}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <section key={col.id} className="w-[min(100%,17rem)] shrink-0 rounded-2xl border bg-card">
            <header className="border-b px-3 py-2">
              <h2 className="text-sm font-bold">{col.label}</h2>
              <p className="text-xs text-muted-foreground tabular-nums">{col.orders.length} đơn</p>
            </header>
            <ul className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
              {col.orders.map((order) => {
                const day = opsCalendarDay(order);
                const hasDue = Boolean(order.dueDate?.trim());
                const lateDue = hasDue && day < today;
                return (
                  <li key={order.id} className="rounded-xl border border-border/60 bg-background p-3 text-sm shadow-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="font-mono text-xs font-semibold text-primary">
                        {order.code}
                      </Link>
                      {lateDue ? <Badge variant="destructive">Trễ hẹn</Badge> : null}
                      {order.late ? <Badge variant="outline">Trễ sàn</Badge> : null}
                    </div>
                    <p className="mt-1 font-medium leading-snug">{order.customerName}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{order.itemSummary || "—"}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {hasDue ? `Hẹn ${day}` : `Tạo ${day.slice(5)}`}
                      {typeof order.fileCount === "number" ? ` · ${order.fileCount} ảnh` : ""}
                      {order.fulfillment === "pickup" ? " · Nhận tại tiệm" : order.fulfillment === "delivery" ? " · Giao" : ""}
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      {statusLabelOf(order.status, order.statusLabel)}
                    </Badge>
                  </li>
                );
              })}
              {col.orders.length === 0 ? (
                <li className="px-2 py-6 text-center text-xs text-muted-foreground">Trống</li>
              ) : null}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
