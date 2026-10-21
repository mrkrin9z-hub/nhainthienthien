import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ALL_TONE, FilterChips, STATUS_TONE, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABEL, type OrderStatus } from "@/domain/types";
import { statusLabelOf } from "@/lib/display-labels";
import { getOrders } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/san-xuat")({
  component: ProductionPage,
});

const QUEUE: OrderStatus[] = ["in", "dong_goi", "giao"];

function ProductionPage() {
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const queue = (orders.data?.orders ?? []).filter((order) => QUEUE.includes(order.status as OrderStatus));
  const rows = queue.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${order.code} ${order.customerName} ${order.itemSummary}`.toLowerCase().includes(needle);
  });
  const chips: FilterChip[] = [
    { id: "all", label: "Tất cả", count: queue.length, ...ALL_TONE },
    ...QUEUE.map((id) => ({
      id,
      label: STATUS_LABEL[id],
      count: queue.filter((order) => order.status === id).length,
      color: STATUS_TONE[id]?.color ?? "#6B7280",
      icon: STATUS_TONE[id]?.icon,
    })),
  ];
  const list = useListPage(rows, `${q}|${status}`);

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Lệnh sản xuất"
        hint="Đơn đang in, đóng gói hoặc chờ giao. Bấm mã để chuyển bước."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã, khách, hàng…"
      />
      <FilterChips label="Bước sản xuất" value={status} chips={chips} onChange={setStatus} />
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="lệnh" onPage={list.setPage} />
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
            {list.slice.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">
                  <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="text-primary">
                    {order.code}
                  </Link>
                </TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{order.itemSummary}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{statusLabelOf(order.status, order.statusLabel)}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {orders.data && queue.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Chưa có đơn trong xưởng.
                </TableCell>
              </TableRow>
            ) : null}
            {orders.data && queue.length > 0 && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Không có lệnh khớp bộ lọc.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
