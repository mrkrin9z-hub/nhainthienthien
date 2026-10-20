import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Columns3, Download, FileSpreadsheet, HandCoins, List, Plus, Wallet } from "lucide-react";

import { CreateOrderForm } from "@/components/admin/create-order-form";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { ClearFilters, FilterSheet, PageToolbar, ToolbarButton, ToolbarLink } from "@/components/admin/page-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OrderLinks } from "@/components/admin/sections";
import { ALL_TONE, FilterChips, STATUS_TONE, type FilterChip } from "@/components/admin/filter-chips";
import { formatMaybe } from "@/lib/brand";
import { downloadExcel, getMe, getOrders } from "@/lib/admin.functions";
import { CHANNEL_LABEL, CHANNELS, STATUS_LABEL, type OrderStatus } from "@/domain/types";

export const Route = createFileRoute("/admin/don-hang/")({
  validateSearch: (search: Record<string, unknown>): { status: string } => ({
    status: typeof search.status === "string" && search.status ? search.status : "all",
  }),
  component: OrdersPage,
});

const SALE_FLOW: OrderStatus[] = ["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong", "huy"];
const PRODUCTION_FLOW: OrderStatus[] = ["in", "dong_goi", "giao"];

function OrdersPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const navigate = useNavigate();
  const { status } = Route.useSearch();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("all");
  const [lateOnly, setLateOnly] = useState(false);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  const queryClient = useQueryClient();
  useEffect(() => {
    if (window.localStorage.getItem("admin-orders-view") === "board") setView("board");
  }, []);
  function setStatus(next: string) {
    void navigate({ to: "/admin/don-hang", search: { status: next } });
  }
  function chooseView(next: "list" | "board") {
    setView(next);
    window.localStorage.setItem("admin-orders-view", next);
  }
  const production = me.data?.role === "production";
  const rows = orders.data?.orders ?? [];
  const flow = production ? PRODUCTION_FLOW : SALE_FLOW;

  const statusChips = useMemo<FilterChip[]>(() => {
    const known = new Set<string>(flow);
    for (const row of rows) known.add(row.status);
    const ids = [...known];
    return [
      { id: "all", label: "Tất cả", count: rows.length, ...ALL_TONE },
      ...ids.map((id) => ({
        id,
        label: STATUS_LABEL[id as OrderStatus] ?? id,
        count: rows.filter((row) => row.status === id).length,
        color: STATUS_TONE[id]?.color ?? "#6B7280",
        icon: STATUS_TONE[id]?.icon,
      })),
    ];
  }, [rows, flow]);

  const unpaidCount = rows.filter((order) => order.remain != null && order.remain > 0).length;
  const shown = rows.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    if (channel !== "all" && order.channel !== channel) return false;
    if (lateOnly && !order.late) return false;
    if (unpaidOnly && !(order.remain != null && order.remain > 0)) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [order.code, order.customerName, order.phone, order.itemSummary, order.channelLabel]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const filterCount = (status !== "all" ? 1 : 0) + (channel !== "all" ? 1 : 0) + (lateOnly ? 1 : 0) + (unpaidOnly ? 1 : 0);
  const list = useListPage(shown, `${status}|${channel}|${lateOnly}|${unpaidOnly}|${q}`);
  const pageRows = list.slice;

  function clearFilters() {
    setStatus("all");
    setChannel("all");
    setLateOnly(false);
    setUnpaidOnly(false);
  }

  function extraFilters() {
    return (
      <>
        <select
          className="h-9 min-w-[10rem] rounded-md border border-input bg-background px-3 text-[13px]"
          aria-label="Lọc kênh"
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
        >
          <option value="all">Mọi kênh ({rows.length})</option>
          {CHANNELS.map((id) => (
            <option key={id} value={id}>
              {CHANNEL_LABEL[id]} ({rows.filter((row) => row.channel === id).length})
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={unpaidOnly}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold active:scale-[0.97] ${unpaidOnly ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
          onClick={() => setUnpaidOnly((value) => !value)}
        >
          <HandCoins className="size-3.5" />
          Chưa thu
          <span className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${unpaidOnly ? "bg-white/25" : "bg-muted"}`}>{unpaidCount}</span>
        </button>
        <button
          type="button"
          aria-pressed={lateOnly}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold active:scale-[0.97] ${lateOnly ? "border-destructive bg-destructive text-white" : "bg-background"}`}
          onClick={() => setLateOnly((value) => !value)}
        >
          <AlarmClock className="size-3.5" />
          Trễ mốc
        </button>
        {filterCount > 0 ? <ClearFilters onClick={clearFilters} /> : null}
      </>
    );
  }

  const columns = (status === "all" ? flow : flow.filter((item) => item === status)).map((item) => ({
    status: item,
    label: STATUS_LABEL[item] ?? item,
    rows: pageRows.filter((order) => order.status === item),
  }));

  return (
    <div className="space-y-3">
      <OrderLinks />
      <PageToolbar
        title="Đơn hàng"
        hint={production ? "Chỉ hiện đơn đang In, Đóng gói hoặc Giao." : undefined}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên, SĐT, mã đơn…"
        filterCount={filterCount}
        onFilter={() => setSheet(true)}
        actions={
          <>
            <ToolbarButton label={view === "board" ? "Danh sách" : "Dạng cột"} icon={view === "board" ? List : Columns3} onClick={() => chooseView(view === "board" ? "list" : "board")} />
            {production ? null : (
              <ToolbarButton
                label="Xuất Excel"
                icon={Download}
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
              />
            )}
            {production ? null : <ToolbarButton label="Tạo đơn" icon={Plus} primary onClick={() => setCreateOpen(true)} />}
            {production ? null : <ToolbarLink label="Nhập Excel" icon={FileSpreadsheet} to="/admin/nhap-don" />}
            {production ? null : <ToolbarLink label="Đối soát COD" icon={Wallet} to="/admin/cod" />}
          </>
        }
        below={
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            {extraFilters()}
          </div>
        }
      />
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo đơn hàng mới</DialogTitle>
          </DialogHeader>
          <CreateOrderForm
            onCreated={() => {
              setCreateOpen(false);
              void queryClient.invalidateQueries({ queryKey: ["orders"] });
            }}
          />
        </DialogContent>
      </Dialog>
      <FilterChips label="Trạng thái đơn" value={status} chips={statusChips} onChange={setStatus} wrap />
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={pageRows.length} noun="đơn" onPage={list.setPage} />
      {view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x" style={{ WebkitOverflowScrolling: "touch" }}>
          {columns.map((column) => {
            const tone = STATUS_TONE[column.status];
            return (
              <section key={column.status} className="w-[min(100%,18.5rem)] shrink-0 snap-start">
                <header className="mb-2 flex items-center gap-2 px-1">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: tone?.color ?? "#6B7280" }} />
                  <h2 className="text-sm font-semibold">{column.label}</h2>
                  <span className="text-xs text-muted-foreground">{column.rows.length}</span>
                </header>
                <div className="space-y-2">
                  {column.rows.map((order) => (
                    <OrderCard key={order.id} order={order} money={!production} />
                  ))}
                  {column.rows.length === 0 ? <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">Không có đơn</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      {view === "list" ? (
      <>
      <div className="grid gap-2 md:hidden">
        {pageRows.map((order) => (
          <OrderCard key={order.id} order={order} money={!production} />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-md border bg-card md:block">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5">STT</th>
              <th className="px-3 py-2.5">Mã đơn</th>
              <th className="px-3 py-2.5">Khách hàng</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5">Kênh</th>
              {production ? null : <th className="px-3 py-2.5 text-right">Số tiền</th>}
              {production ? null : <th className="px-3 py-2.5 text-right">Đã thu</th>}
              {production ? null : <th className="px-3 py-2.5 text-right">Còn lại</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((order, index) => (
              <tr
                key={order.id}
                className="cursor-pointer border-t hover:bg-muted/30"
                onClick={() => navigate({ to: "/admin/don-hang/$code", params: { code: order.code } })}
              >
                <td className="px-3 py-2.5 text-muted-foreground">{list.start + index + 1}</td>
                <td className="px-3 py-2.5 font-semibold">
                  <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="text-primary">
                    {order.code}
                  </Link>
                  {order.late ? <span className="ml-2 text-[11px] font-bold text-destructive">Trễ</span> : null}
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{order.customerName}</p>
                  <p className="text-[11px] text-muted-foreground">{order.phone}</p>
                </td>
                <td className="px-3 py-2.5"><StatusPill status={order.status} label={order.statusLabel} /></td>
                <td className="px-3 py-2.5">{order.channelLabel}</td>
                {production ? null : (
                  <>
                    <td className="px-3 py-2.5 text-right font-semibold">{order.total == null ? "Chưa có giá" : formatMaybe(order.total)}</td>
                    <td className="px-3 py-2.5 text-right">{formatMaybe(order.depositPaid)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{order.remain == null ? "—" : formatMaybe(order.remain)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {orders.data && shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {rows.length === 0
            ? production
              ? "Không có đơn đang In, Đóng gói hoặc Giao."
              : "Chưa có đơn. Đơn trên web sẽ hiện ở đây sau khi khách gửi ảnh."
            : "Không có đơn hàng nào phù hợp bộ lọc."}
        </p>
      ) : null}
      </>
      ) : null}
      <FilterSheet open={sheet} onClose={() => setSheet(false)} title="Bộ lọc đơn hàng">
        {extraFilters()}
      </FilterSheet>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const tone = STATUS_TONE[status];
  const Icon = tone?.icon;
  const color = tone?.color ?? "#4B5563";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ backgroundColor: color }}>
      {Icon ? <Icon className="size-3" /> : null}
      {label}
    </span>
  );
}

function OrderCard({
  order,
  money,
}: {
  order: {
    id: string;
    code: string;
    status: string;
    statusLabel: string;
    customerName: string;
    phone: string;
    channelLabel: string;
    itemSummary: string;
    total: number | null;
    depositPaid?: number | null;
    remain?: number | null;
    fileCount: number;
    late: boolean;
  };
  money: boolean;
}) {
  return (
    <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="block rounded-2xl border border-border/70 bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-primary">{order.code}</p>
          <p className="truncate text-sm text-muted-foreground">{order.customerName} · {order.phone}</p>
        </div>
        <StatusPill status={order.status} label={order.statusLabel} />
      </div>
      <p className="line-clamp-2 text-sm">{order.itemSummary}</p>
      {order.late ? <p className="mt-1 text-sm font-semibold text-destructive">Trễ mốc</p> : null}
      <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
        <span className="text-muted-foreground">{order.channelLabel}</span>
        <span className="text-right font-semibold">
          {money && order.total != null ? formatMaybe(order.total) : `${order.fileCount} ảnh`}
          {money && order.remain != null ? <span className="block text-xs font-normal text-muted-foreground">Còn {formatMaybe(order.remain)}</span> : null}
        </span>
      </div>
    </Link>
  );
}
