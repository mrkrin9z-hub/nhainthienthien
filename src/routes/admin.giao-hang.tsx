import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { formatMaybe } from "@/lib/brand";
import { getDeliveries, getMe } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/giao-hang")({
  component: DeliveryPage,
});

function DeliveryPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const rows = useQuery({ queryKey: ["deliveries"], queryFn: () => getDeliveries() });
  const money = me.data?.role !== "production";
  if (rows.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (rows.isError) return <p className="font-semibold text-destructive">{(rows.error as Error).message}</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Giao hàng</h1>
      <p className="text-sm text-muted-foreground">Đơn giao tận nơi và đơn Facebook, TikTok, Shopee. Tem 100×150 chỉ in cho đơn tại tiệm và Facebook.</p>
      <div className="grid gap-3">
        {(rows.data ?? []).map((order) => (
          <article key={order.id} className="glass-card space-y-1 rounded-3xl p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="text-lg font-extrabold text-primary">
                {order.code}
              </Link>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{order.statusLabel}</span>
            </div>
            <p>{order.recipientName || order.customerName} · {order.phone}</p>
            {order.recipientName && order.recipientName !== order.customerName ? <p>Khách trong sổ: {order.customerName}</p> : null}
            {order.address ? <p>{order.address}</p> : null}
            <p className="text-muted-foreground">{order.channelLabel} · {order.itemSummary}</p>
            <p>Hãng: {order.carrier || "chưa ghi"} · Vận đơn: {order.tracking || "chưa có"}</p>
            {money ? (
              <p>Phí ship: {order.shipFee === null ? "chưa có" : formatMaybe(order.shipFee)} · COD: {order.codAmount === null ? "không" : formatMaybe(order.codAmount)}</p>
            ) : null}
            {order.canLabel && money ? (
              <Button asChild variant="outline" className="mt-2 min-h-11">
                <Link to="/admin/tem/$code" params={{ code: order.code }}>In tem 100×150</Link>
              </Button>
            ) : null}
          </article>
        ))}
        {rows.data && rows.data.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có đơn cần giao.</p> : null}
      </div>
    </div>
  );
}
