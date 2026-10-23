import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlarmClock, HandCoins, MoreHorizontal, Plus, Printer } from "lucide-react";

import { DateRangeField, vnDayOf } from "@/components/admin/date-range";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { ClearFilters, FilterSheet, PageToolbar, ToolbarButton, ToolbarLink } from "@/components/admin/page-toolbar";
import { ALL_TONE, FilterChips, STATUS_TONE, type FilterChip } from "@/components/admin/filter-chips";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatMaybe } from "@/lib/brand";
import { changeStatus, downloadExcel, getMe, getOrders, setFulfillment } from "@/lib/admin.functions";
import { CHANNEL_LABEL, CHANNELS, STATUS_LABEL, type OrderStatus } from "@/domain/types";
import { channelLabelOf, statusLabelOf } from "@/lib/display-labels";

export const Route = createFileRoute("/admin/don-hang/")({
  validateSearch: (search: Record<string, unknown>): { status: string; q: string } => ({
    status: typeof search.status === "string" && search.status ? search.status : "all",
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: OrdersPage,
});

const SALE_FLOW: OrderStatus[] = ["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong", "huy"];
const PRODUCTION_FLOW: OrderStatus[] = ["in", "dong_goi", "giao"];

type OrderRow = {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  customerName: string;
  phone: string;
  channel: string;
  channelLabel: string;
  itemSummary: string;
  total: number | null;
  depositPaid?: number | null;
  remain?: number | null;
  fileCount: number;
  late: boolean;
  fulfillment: "pickup" | "delivery";
};

function OrdersPage() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const navigate = useNavigate();
  const { status, q: routeQ } = Route.useSearch();
  const [q, setQ] = useState(routeQ);
  useEffect(() => {
    setQ(routeQ);
  }, [routeQ]);
  const [channel, setChannel] = useState("all");
  const [lateOnly, setLateOnly] = useState(false);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [place, setPlace] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [view, setView] = useState<"list" | "board">("list");
  useEffect(() => {
    if (window.localStorage.getItem("admin-orders-view") === "board") setView("board");
  }, []);
  function setStatus(next: string) {
    void navigate({ to: "/admin/don-hang", search: { status: next, q } });
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
    if (place !== "all" && order.fulfillment !== place) return false;
    const day = vnDayOf(order.createdAt);
    if (fromDay && day && day < fromDay) return false;
    if (toDay && day && day > toDay) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [order.code, order.customerName, order.phone, order.itemSummary, channelLabelOf(order.channel, order.channelLabel)]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const filterCount = (status !== "all" ? 1 : 0) + (channel !== "all" ? 1 : 0) + (lateOnly ? 1 : 0) + (unpaidOnly ? 1 : 0) + (place !== "all" ? 1 : 0) + (fromDay || toDay ? 1 : 0);
  const list = useListPage(shown, `${status}|${channel}|${lateOnly}|${unpaidOnly}|${place}|${q}|${fromDay}|${toDay}`);
  const pageRows = list.slice;

  function clearFilters() {
    setStatus("all");
    setChannel("all");
    setLateOnly(false);
    setUnpaidOnly(false);
    setFromDay("");
    setToDay("");
    setPlace("all");
  }

  function togglePick(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function printBills(codes: string[]) {
    let blocked = 0;
    for (const code of codes) {
      const opened = window.open(`/admin/phieu/${encodeURIComponent(code)}`, "_blank", "noopener");
      if (!opened) blocked += 1;
    }
    if (blocked) toast.error("Trình duyệt chặn cửa sổ in. Hãy cho phép popup rồi in lại.");
  }

  async function markDelivered(order: OrderRow) {
    setBusy(order.id);
    try {
      const note = order.fulfillment === "pickup" ? "Khách đã nhận tại tiệm" : "Đã giao";
      await changeStatus({ data: { orderId: order.id, status: "xong", note } });
      toast.success(order.fulfillment === "pickup" ? `${order.code}: khách đã nhận` : `${order.code}: đã giao`);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function choosePlace(order: OrderRow, fulfillment: "pickup" | "delivery") {
    if (order.fulfillment === fulfillment) return;
    setBusy(order.id);
    try {
      await setFulfillment({ data: { orderId: order.id, fulfillment } });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function extraFilters() {
    return (
      <>
        <DateRangeField from={fromDay} to={toDay} onChange={(from, to) => { setFromDay(from); setToDay(to); }} />
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
        <select
          className="h-9 min-w-[10rem] rounded-md border border-input bg-background px-3 text-[13px]"
          aria-label="Lọc nơi nhận"
          value={place}
          onChange={(event) => setPlace(event.target.value)}
        >
          <option value="all">Mọi nơi nhận</option>
          <option value="pickup">Lấy tại xưởng</option>
          <option value="delivery">Giao hàng</option>
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
      <PageToolbar
        title="Đơn hàng"
        hint={production ? "In, đóng gói và giao ngay trên danh sách." : "In bill và giao hàng ngay trên danh sách."}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên, SĐT, mã đơn…"
        filterCount={filterCount}
        onFilter={() => setSheet(true)}
        actions={
          <>
            {picked.length > 0 ? (
              <ToolbarButton label={`In bill (${picked.length})`} icon={Printer} primary onClick={() => printBills(rows.filter((order) => picked.includes(order.id)).map((order) => order.code))} />
            ) : production ? null : (
              <ToolbarLink label="Tạo đơn" icon={Plus} primary to="/orders/create" />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex size-9 items-center justify-center rounded-md border bg-background" aria-label="Thêm thao tác">
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => chooseView(view === "board" ? "list" : "board")}>
                  {view === "board" ? "Danh sách" : "Dạng cột"}
                </DropdownMenuItem>
                {production ? null : (
                  <DropdownMenuItem
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
                  </DropdownMenuItem>
                )}
                {production ? null : (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/nhap-don">Nhập Excel</Link>
                  </DropdownMenuItem>
                )}
                {production ? null : (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/cod">Đối soát COD</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
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
                    <OrderCard
                      key={order.id}
                      order={order}
                      money={!production}
                      picked={picked.includes(order.id)}
                      busy={busy === order.id}
                      onPick={() => togglePick(order.id)}
                      onPlace={(fulfillment) => void choosePlace(order, fulfillment)}
                      onDone={() => void markDelivered(order)}
                    />
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
          <OrderCard
            key={order.id}
            order={order}
            money={!production}
            picked={picked.includes(order.id)}
            busy={busy === order.id}
            onPick={() => togglePick(order.id)}
            onPlace={(fulfillment) => void choosePlace(order, fulfillment)}
            onDone={() => void markDelivered(order)}
          />
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-md border bg-card md:block">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Chọn đơn trên trang"
                  checked={pageRows.length > 0 && pageRows.every((order) => picked.includes(order.id))}
                  onChange={() => {
                    const ids = pageRows.map((order) => order.id);
                    const all = ids.every((id) => picked.includes(id));
                    setPicked((current) => (all ? current.filter((id) => !ids.includes(id)) : [...new Set([...current, ...ids])]));
                  }}
                />
              </th>
              <th className="px-3 py-2.5">Mã đơn</th>
              <th className="px-3 py-2.5">Khách hàng</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5">Nhận hàng</th>
              {production ? null : <th className="px-3 py-2.5 text-right">Còn lại</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer border-t hover:bg-muted/30"
                onClick={() => navigate({ to: "/admin/don-hang/$code", params: { code: order.code } })}
              >
                <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" aria-label={`Chọn ${order.code}`} checked={picked.includes(order.id)} onChange={() => togglePick(order.id)} />
                </td>
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
                <td className="px-3 py-2.5"><StatusPill status={order.status} label={statusLabelOf(order.status, order.statusLabel)} /></td>
                <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                  <OrderActions order={order} busy={busy === order.id} onPlace={(fulfillment) => void choosePlace(order, fulfillment)} onDone={() => void markDelivered(order)} />
                </td>
                {production ? null : (
                  <td className="px-3 py-2.5 text-right font-semibold">{order.remain == null ? "—" : formatMaybe(order.remain)}</td>
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
        <FilterChips label="Trạng thái đơn" value={status} chips={statusChips} onChange={setStatus} wrap />
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

function OrderActions({
  order,
  busy,
  onPlace,
  onDone,
}: {
  order: OrderRow;
  busy: boolean;
  onPlace: (fulfillment: "pickup" | "delivery") => void;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select
        className="h-8 rounded-md border bg-background px-2 text-[12px]"
        aria-label={`Nơi nhận ${order.code}`}
        value={order.fulfillment}
        disabled={busy}
        onChange={(event) => onPlace(event.target.value as "pickup" | "delivery")}
      >
        <option value="pickup">Lấy tại xưởng</option>
        <option value="delivery">Giao hàng</option>
      </select>
      <a
        href={`/admin/phieu/${encodeURIComponent(order.code)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-8 items-center rounded-md border px-2 text-[12px] font-semibold"
        onClick={(event) => event.stopPropagation()}
      >
        In bill
      </a>
      {order.status === "giao" ? (
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md bg-[#2563eb] px-2 text-[12px] font-semibold text-white disabled:opacity-50"
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            onDone();
          }}
        >
          {order.fulfillment === "pickup" ? "Khách đã nhận" : "Đã giao"}
        </button>
      ) : null}
    </div>
  );
}

function OrderCard({
  order,
  money,
  picked,
  busy,
  onPick,
  onPlace,
  onDone,
}: {
  order: OrderRow;
  money: boolean;
  picked: boolean;
  busy: boolean;
  onPick: () => void;
  onPlace: (fulfillment: "pickup" | "delivery") => void;
  onDone: () => void;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <input type="checkbox" className="mt-1" aria-label={`Chọn ${order.code}`} checked={picked} onChange={onPick} />
          <div className="min-w-0">
            <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="font-semibold text-primary">{order.code}</Link>
            <p className="truncate text-sm text-muted-foreground">{order.customerName} · {order.phone}</p>
          </div>
        </div>
        <StatusPill status={order.status} label={statusLabelOf(order.status, order.statusLabel)} />
      </div>
      <p className="line-clamp-2 text-sm">{order.itemSummary}</p>
      {order.late ? <p className="mt-1 text-sm font-semibold text-destructive">Trễ mốc</p> : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <span className="text-muted-foreground">{channelLabelOf(order.channel, order.channelLabel)}</span>
        <span className="text-right font-semibold">
          {money && order.total != null ? formatMaybe(order.total) : `${order.fileCount} ảnh`}
          {money && order.remain != null ? <span className="block text-xs font-normal text-muted-foreground">Còn {formatMaybe(order.remain)}</span> : null}
        </span>
      </div>
      <div className="mt-3">
        <OrderActions order={order} busy={busy} onPlace={onPlace} onDone={onDone} />
      </div>
    </article>
  );
}
