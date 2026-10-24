import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, Plus, Truck } from "lucide-react";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar, ToolbarButton, ToolbarLink } from "@/components/admin/page-toolbar";
import {
  DESK_CHANNEL_LABEL,
  DESK_TABS,
  deskAlerts,
  deskTabMeta,
  matchesAlert,
  paymentLabel,
  shipModeLabel,
  type DeskAlertId,
  type DeskTab,
  type ShipMode,
} from "@/domain/order-desk";
import { changeStatus, downloadExcel, getMe, getOrders, markLabelsPrinted, setFulfillment } from "@/lib/admin.functions";
import { formatMaybe } from "@/lib/brand";
import type { Channel } from "@/domain/types";

type Item = {
  name: string;
  skuCode: string;
  sellerSku: string;
  variant: string;
  quantity: number;
  unitPrice: number | null;
};

type Row = {
  id: string;
  code: string;
  status: string;
  channel: Channel;
  fulfillment: "pickup" | "delivery";
  buyerName: string;
  channelOrderId: string;
  createdAt: string;
  shipBy: string | null;
  autoCancelAt: string | null;
  shipMode: ShipMode;
  deskTab: DeskTab;
  carrier: string;
  tracking: string;
  paymentMethod: string;
  total: number | null;
  netAmount: number | null;
  designFileUrl: string;
  labelPrintedAt: string | null;
  customerNote: string;
  items: Item[];
};

const control = "h-9 rounded-md border border-input bg-background px-3 text-[13px]";

function vnTime(iso: string | null): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  return at.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function hoursLeft(iso: string | null): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return (at - Date.now()) / 3_600_000;
}

export function OrderManager({ status, q, onStatus }: { status: string; q: string; onStatus: (status: string, q: string) => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const [text, setText] = useState(q);
  const [channel, setChannel] = useState("all");
  const [ship, setShip] = useState("all");
  const [label, setLabel] = useState("all");
  const [carrier, setCarrier] = useState("all");
  const [alert, setAlert] = useState<DeskAlertId | "">("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => setText(q), [q]);

  const production = me.data?.role === "production";
  const rows = (orders.data?.orders ?? []) as Row[];
  const cards = useMemo(() => deskAlerts(rows), [rows]);
  const carriers = [...new Set(rows.map((row) => row.carrier.trim()).filter(Boolean))].sort();
  const channels = (["tai_tiem", "facebook", "tiktok", "shopee", "mo_home"] as Channel[]).filter((id) => me.data?.role === "sale" ? id !== "mo_home" : true);

  const shown = rows.filter((order) => {
    if (status !== "all" && order.deskTab !== status) return false;
    if (channel !== "all" && order.channel !== channel) return false;
    if (ship !== "all" && order.shipMode !== ship) return false;
    if (label === "da_in" && !order.labelPrintedAt) return false;
    if (label === "chua_in" && order.labelPrintedAt) return false;
    if (carrier !== "all" && order.carrier !== carrier) return false;
    if (alert && !matchesAlert(order, alert)) return false;
    const needle = text.trim().toLowerCase();
    if (!needle) return true;
    const sku = order.items.map((item) => `${item.sellerSku} ${item.skuCode} ${item.variant} ${item.name}`).join(" ");
    return [order.code, order.channelOrderId, order.buyerName, order.tracking, order.carrier, sku].join(" ").toLowerCase().includes(needle);
  });
  const list = useListPage(shown, `${status}|${channel}|${ship}|${label}|${carrier}|${alert}|${text}`);
  const pageRows = list.slice;
  const tab = (DESK_TABS.find((item) => item.id === status)?.id ?? "all") as DeskTab;
  const note = deskTabMeta(tab);

  function toggle(id: string) {
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

  async function printProduction(ids: string[], codes: string[]) {
    let blocked = 0;
    for (const code of codes) {
      const opened = window.open(`/admin/phieu/${encodeURIComponent(code)}?loai=sx`, "_blank", "noopener");
      if (!opened) blocked += 1;
    }
    if (blocked) toast.error("Trình duyệt chặn phiếu sản xuất.");
    try {
      await markLabelsPrinted({ data: { orderIds: ids } });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function markShipped(selected: Row[]) {
    const ready = selected.filter((order) => order.status === "dong_goi");
    const skipped = selected.length - ready.length;
    for (const order of ready) {
      try {
        await changeStatus({ data: { orderId: order.id, status: "giao", note: "Đánh dấu đã gửi" } });
      } catch (error) {
        toast.error(`${order.code}: ${(error as Error).message}`);
      }
    }
    if (skipped) toast.message(`${skipped} đơn chưa ở bước đóng gói, chưa đánh dấu đã gửi.`);
    if (ready.length) toast.success(`Đã gửi ${ready.length} đơn`);
    setPicked([]);
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
    await queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
  }

  async function choosePlace(order: Row, fulfillment: "pickup" | "delivery") {
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

  async function markDone(order: Row) {
    setBusy(order.id);
    try {
      const noteText = order.shipMode === "pickup" ? "Khách đã nhận tại tiệm" : "Đã giao";
      await changeStatus({ data: { orderId: order.id, status: "xong", note: noteText } });
      toast.success(order.shipMode === "pickup" ? `${order.code}: khách đã nhận` : `${order.code}: đã giao`);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const selected = rows.filter((order) => picked.includes(order.id));

  return (
    <div className="space-y-3">
      <PageToolbar
        title="Đơn hàng"
        hint="Một sổ cho TikTok, Shopee, bán lẻ và Facebook. Nhập tay, chưa nối API."
        search={text}
        onSearch={setText}
        searchPlaceholder="Tìm mã đơn, mã sàn, SKU, vận đơn…"
        actions={
          <>
            {picked.length > 0 ? (
              <>
                <ToolbarButton label={`In bill (${picked.length})`} icon={Printer} primary onClick={() => printBills(selected.map((order) => order.code))} />
                <ToolbarButton label={`In phiếu sản xuất (${picked.length})`} icon={Printer} onClick={() => void printProduction(selected.map((order) => order.id), selected.map((order) => order.code))} />
                <ToolbarButton label="Đánh dấu đã gửi" icon={Truck} onClick={() => void markShipped(selected)} />
              </>
            ) : production ? null : (
              <ToolbarLink label="Tạo đơn" icon={Plus} primary to="/orders/create" />
            )}
            {production ? null : (
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border bg-background px-3 text-[13px] font-semibold"
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
                Xuất
              </button>
            )}
          </>
        }
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            aria-pressed={alert === card.id}
            className={`min-w-[9.5rem] rounded-md border px-3 py-2 text-left ${alert === card.id ? "border-primary bg-primary/5" : "bg-card"} ${card.count > 0 ? "" : "opacity-70"}`}
            onClick={() => setAlert((current) => (current === card.id ? "" : card.id))}
          >
            <span className="block text-lg font-bold leading-none">{card.count}</span>
            <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">{card.label}</span>
          </button>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto border-b">
        {DESK_TABS.map((item) => {
          const count = item.id === "all" ? rows.length : rows.filter((order) => order.deskTab === item.id).length;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              onClick={() => onStatus(item.id, text)}
            >
              {item.label}
              <span className="ml-1 rounded-full bg-muted px-1.5 text-[11px]">{count}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">Shopee gọi là {note.shopee}. TikTok gọi là {note.tiktok}.</p>

      <div className="flex flex-wrap items-center gap-2">
        {channels.map((id) => (
          <button
            key={id}
            type="button"
            className={`h-8 rounded-full border px-3 text-[12px] font-semibold ${channel === id ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
            onClick={() => setChannel((current) => (current === id ? "all" : id))}
          >
            {DESK_CHANNEL_LABEL[id]}
          </button>
        ))}
        <select className={control} aria-label="Cách giao" value={ship} onChange={(event) => setShip(event.target.value)}>
          <option value="all">Mọi cách giao</option>
          <option value="san">Nhãn sàn</option>
          <option value="tu_giao">Tự giao</option>
          <option value="pickup">Lấy tại xưởng</option>
        </select>
        <select className={control} aria-label="Trạng thái nhãn" value={label} onChange={(event) => setLabel(event.target.value)}>
          <option value="all">Mọi nhãn</option>
          <option value="chua_in">Chưa in phiếu</option>
          <option value="da_in">Đã in phiếu</option>
        </select>
        <select className={control} aria-label="Nhà vận chuyển" value={carrier} onChange={(event) => setCarrier(event.target.value)}>
          <option value="all">Mọi hãng</option>
          {carriers.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={pageRows.length} noun="đơn" onPage={list.setPage} />

      <div className="space-y-2">
        {pageRows.map((order) => {
          const late = hoursLeft(order.shipBy);
          return (
            <article key={order.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-start gap-3">
                <input type="checkbox" className="mt-1" aria-label={`Chọn ${order.code}`} checked={picked.includes(order.id)} onChange={() => toggle(order.id)} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{DESK_CHANNEL_LABEL[order.channel]}</span>
                    <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="font-semibold text-primary">{order.code}</Link>
                    {order.channelOrderId ? <span className="font-mono text-[12px] text-muted-foreground">{order.channelOrderId}</span> : null}
                    <span className="text-[12px] text-muted-foreground">{order.deskTab ? deskTabMeta(order.deskTab).label : ""}</span>
                    <span className="text-[12px] text-muted-foreground">{vnTime(order.createdAt)}</span>
                  </div>
                  <p className="text-sm">{order.buyerName}</p>
                  <ul className="space-y-1 text-[13px]">
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${index}`}>
                        <span className="font-medium">{item.sellerSku || item.skuCode}</span>
                        {item.variant ? <span className="text-muted-foreground"> · {item.variant}</span> : null}
                        <span className="text-muted-foreground"> · {item.name} · ×{item.quantity}</span>
                        {item.unitPrice != null ? <span> · {formatMaybe(item.unitPrice)}</span> : null}
                      </li>
                    ))}
                  </ul>
                  {order.customerNote ? <p className="text-[12px] text-muted-foreground">Ghi chú: {order.customerNote}</p> : null}
                  {order.designFileUrl ? <a className="text-[12px] font-semibold text-primary" href={order.designFileUrl} target="_blank" rel="noreferrer">Ảnh thiết kế</a> : null}
                </div>
                <div className="w-full space-y-1 text-[13px] sm:w-56">
                  <p>Hạn gửi: {vnTime(order.shipBy)}{late != null && late < 0 ? <span className="ml-1 font-semibold text-destructive">Quá hạn</span> : null}</p>
                  <p>Tự hủy: {vnTime(order.autoCancelAt)}</p>
                  <p>{shipModeLabel(order.shipMode)}{order.carrier ? ` · ${order.carrier}` : ""}</p>
                  <p className="font-mono text-[12px]">{order.tracking || "Chưa có vận đơn"}</p>
                  {production ? null : <p>{paymentLabel(order.paymentMethod)} · {formatMaybe(order.total)}</p>}
                  {production || order.netAmount == null ? null : <p className="text-muted-foreground">Thực nhận {formatMaybe(order.netAmount)}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <a className="inline-flex h-8 items-center rounded-md border px-2 text-[12px] font-semibold" href={`/admin/phieu/${encodeURIComponent(order.code)}`} target="_blank" rel="noreferrer">In bill</a>
                    {order.shipMode === "san" ? <span className="inline-flex h-8 items-center text-[12px] text-muted-foreground">Nhãn sàn</span> : (
                      <select className="h-8 rounded-md border bg-background px-2 text-[12px]" aria-label={`Nơi nhận ${order.code}`} value={order.fulfillment} disabled={busy === order.id} onChange={(event) => void choosePlace(order, event.target.value as "pickup" | "delivery")}>
                        <option value="pickup">Lấy tại xưởng</option>
                        <option value="delivery">Tự giao</option>
                      </select>
                    )}
                    {order.status === "giao" ? (
                      <button type="button" className="inline-flex h-8 items-center rounded-md bg-[#2563eb] px-2 text-[12px] font-semibold text-white disabled:opacity-50" disabled={busy === order.id} onClick={() => void markDone(order)}>
                        {order.shipMode === "pickup" ? "Khách đã nhận" : "Đã giao"}
                      </button>
                    ) : null}
                    <button type="button" className="text-[12px] font-semibold text-primary" onClick={() => navigate({ to: "/admin/don-hang/$code", params: { code: order.code } })}>Chi tiết</button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
        {orders.data && shown.length === 0 ? <p className="text-sm text-muted-foreground">Không có đơn trong bộ lọc này.</p> : null}
      </div>
    </div>
  );
}
