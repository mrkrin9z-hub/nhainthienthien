import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

import { ALL_TONE, FilterChips, STATUS_TONE, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { FilterSheet, PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABEL, CHANNELS, STATUS_LABEL, type OrderStatus } from "@/domain/types";
import { MoreHorizontal } from "lucide-react";
import { getOrders } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/in-don")({
  component: PrintOrdersPage,
});

function PrintOrdersPage() {
  const navigate = useNavigate();
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [filters, setFilters] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const rows = orders.data?.orders ?? [];
  const statusChips = useMemo<FilterChip[]>(() => {
    const ids = [...new Set(rows.map((row) => row.status))];
    return [
      { id: "all", label: "Tất cả", count: rows.length, ...ALL_TONE },
      ...ids.map((id) => ({
        id,
        label: STATUS_LABEL[id as OrderStatus] ?? id,
        count: rows.filter((row) => row.status === id).length,
        color: STATUS_TONE[id]?.color ?? "#6B7280",
      })),
    ];
  }, [rows]);
  const shown = rows.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    if (channel !== "all" && order.channel !== channel) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [order.code, order.customerName, order.phone].join(" ").toLowerCase().includes(needle);
  });
  const list = useListPage(shown, `${q}|${status}|${channel}`);
  const filterCount = (status !== "all" ? 1 : 0) + (channel !== "all" ? 1 : 0);

  function printCode(value: string) {
    const next = value.trim().toUpperCase();
    if (!next) return;
    void navigate({ to: "/admin/phieu/$code", params: { code: next } });
  }

  return (
    <div className="space-y-3">
      <PageToolbar
        title="In đơn (K80)"
        hint="Phiếu giao nhận in khổ K80. A5 và A4 vẫn chọn được trên phiếu."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã, tên, SĐT…"
        filterCount={filterCount}
        onFilter={() => setFilters(true)}
        actions={<ToolbarButton label="In theo mã" icon={Printer} primary onClick={() => setOpen(true)} />}
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc in đơn">
        <FilterChips label="Trạng thái" value={status} chips={statusChips} onChange={setStatus} wrap />
        <label className="text-sm font-semibold">
          Kênh
          <select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" aria-label="Lọc kênh" value={channel} onChange={(event) => setChannel(event.target.value)}>
            <option value="all">Mọi kênh</option>
            {CHANNELS.map((id) => (
              <option key={id} value={id}>
                {CHANNEL_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
      </FilterSheet>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>In theo mã</DialogTitle>
          </DialogHeader>
          <label className="text-sm font-semibold">
            Mã đơn
            <Input className="mt-1 min-h-11" aria-label="Mã đơn cần in" value={code} onChange={(event) => setCode(event.target.value)} placeholder="TT261022-001" />
          </label>
          <DialogFooter>
            <Button className="min-h-11" onClick={() => printCode(code)}>
              Mở phiếu K80
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="đơn" onPage={list.setPage} />
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {list.slice.map((order) => (
          <li key={order.id} className="flex items-center gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{order.code}</p>
              <p className="text-sm text-muted-foreground">
                {order.customerName} · {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex size-8 items-center justify-center rounded-md border" aria-label={`Thao tác ${order.code}`}>
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/admin/phieu/$code" params={{ code: order.code }}>
                    In K80
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      {orders.data && shown.length === 0 ? <p className="text-sm text-muted-foreground">Không có đơn khớp.</p> : null}
    </div>
  );
}
