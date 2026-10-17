import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatMaybe } from "@/lib/brand";
import { getCustomer, saveCustomer } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/khach/$id")({
  component: CustomerPage,
});

function CustomerPage() {
  const { id } = Route.useParams();
  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => getCustomer({ data: { id } }) });
  const [note, setNote] = useState<string | null>(null);
  if (!customer.data) return <p className="text-muted-foreground">{customer.isError ? (customer.error as Error).message : "Đang tải…"}</p>;
  const data = customer.data;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">{data.name}</h1>
      <p className="text-sm">
        {data.phone}
        {data.address ? ` · ${data.address}` : ""}
      </p>
      <Textarea value={note ?? data.note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú chăm sóc" />
      <Button
        className="min-h-11"
        onClick={async () => {
          await saveCustomer({ data: { id, note: note ?? data.note } });
          toast.success("Đã lưu ghi chú khách");
        }}
      >
        Lưu ghi chú
      </Button>
      <h2 className="text-lg font-bold text-primary">Đơn đã đặt</h2>
      <ul className="space-y-2">
        {data.orders.map((order) => (
          <li key={order.id}>
            <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="glass-card block rounded-3xl p-4">
              <p className="font-bold">{order.code}</p>
              <p className="text-sm text-muted-foreground">
                {order.statusLabel} · {order.total === null ? "Chưa có giá" : formatMaybe(order.total)}
              </p>
              <p className="text-sm">{order.itemSummary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
