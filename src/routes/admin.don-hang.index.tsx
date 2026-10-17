import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { formatMaybe } from "@/lib/brand";
import { downloadExcel, getOrders } from "@/lib/admin.functions";
import { STATUS_LABEL, type OrderStatus } from "@/domain/types";

export const Route = createFileRoute("/admin/don-hang/")({
  component: OrdersPage,
});

function OrdersPage() {
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-primary">Đơn hàng</h1>
        <div className="flex gap-2">
          <Button asChild className="min-h-11 bg-accent text-accent-foreground">
            <Link to="/admin/don-moi">Ghi đơn</Link>
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              const file = await downloadExcel({ data: { kind: "orders", month: "all" } });
              const blob = new Blob([file.xml], { type: "application/vnd.ms-excel" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = file.filename;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Xuất Excel
          </Button>
        </div>
      </div>
      <div className="grid gap-3">
        {(orders.data?.orders ?? []).map((order) => (
          <Link key={order.id} to="/admin/don-hang/$code" params={{ code: order.code }} className="glass-card block rounded-3xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-extrabold text-primary">{order.code}</p>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {STATUS_LABEL[order.status as OrderStatus] ?? order.statusLabel}
              </span>
            </div>
            <p className="mt-1 text-sm">
              {order.customerName} · {order.phone} · {order.channelLabel}
              {order.late ? <strong className="text-destructive"> · Trễ mốc</strong> : null}
            </p>
            <p className="text-sm text-muted-foreground">{order.itemSummary}</p>
            <p className="mt-1 text-sm font-semibold">{order.total === null ? `${order.fileCount} ảnh` : `${formatMaybe(order.total)} · ${order.fileCount} ảnh`}</p>
          </Link>
        ))}
        {orders.data && orders.data.orders.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có đơn. Đơn trên web sẽ hiện ở đây sau khi khách gửi ảnh.</p> : null}
      </div>
    </div>
  );
}
