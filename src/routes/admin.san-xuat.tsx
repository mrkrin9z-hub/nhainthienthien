import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOrders } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/san-xuat")({
  component: ProductionPage,
});

const QUEUE = new Set(["in", "dong_goi", "giao"]);

function ProductionPage() {
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const rows = (orders.data?.orders ?? []).filter((order) => QUEUE.has(order.status));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Lệnh sản xuất</h1>
        <p className="text-sm text-muted-foreground">Đơn đang in, đóng gói hoặc chờ giao. Bấm mã để chuyển bước.</p>
      </div>
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Khách</TableHead>
              <TableHead>Hàng</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">
                  <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="text-primary">
                    {order.code}
                  </Link>
                </TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{order.itemSummary}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{order.statusLabel}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {orders.data && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Chưa có đơn trong xưởng.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
