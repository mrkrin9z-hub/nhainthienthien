import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, Plus, Truck, Upload } from "lucide-react";
import { OrderImportDialog } from "@/components/admin/order-import-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar, ToolbarButton, ToolbarLink } from "@/components/admin/page-toolbar";
import {
  DESK_CHANNEL_LABEL,
  DESK_TABS,
  deskAlerts,
  listStatusChoices,
  matchesAlert,
  type DeskAlertId,
  type DeskTab,
  type ShipMode,
} from "@/domain/order-desk";
import { STATUS_LABEL, type Channel, type OrderStatus } from "@/domain/types";
import { changeStatus, downloadExcel, getMe, getOrders, markLabelsPrinted } from "@/lib/admin.functions";
import { formatMaybe } from "@/lib/brand";

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
  customerPhotoCount?: number;
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
  const [importOpen, setImportOpen] = useState(false);
  const [pending, setPending] = useState<{ order: Row; status: OrderStatus } | null>(null);
  const [reason, setReason] = useState("");
  useEffect(() => setText(q), [q]);

  const production = me.data?.role === "production";
  const rows = (orders.data?.orders ?? []) as Row[];
  const cards = useMemo(() => deskAlerts(rows), [rows]);
  const carriers = [...new Set(rows.map((row) => row.carrier.trim()).filter(Boolean))].sort();
  const channels = (["tai_tiem", "facebook", "tiktok", "shopee", "mo_home"] as Channel[]).filter((id) => me.data?.role === "sale" ? id !== "mo_home" : true);
  const tab = (DESK_TABS.find((item) => item.id === status)?.id ?? "can_lam") as DeskTab;

  const shown = rows.filter((order) => {
    if (order.deskTab !== tab) return false;
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

  async function applyStatus(order: Row, status: OrderStatus, note: string) {
    setBusy(order.id);
    try {
      await changeStatus({ data: { orderId: order.id, status, note } });
      toast.success(`${order.code}: ${STATUS_LABEL[status]}`);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function requestStatus(order: Row, status: OrderStatus) {
    if (status === order.status) return;
    if (status === "huy" || order.status === "xong" || order.status === "huy") {
      setReason("");
      setPending({ order, status });
      return;
    }
    void applyStatus(order, status, "");
  }

  const selected = rows.filter((order) => picked.includes(order.id));

  return (
    <div className="space-y-3">
      <PageToolbar
        title="Đơn hàng"
        hint="Khách lẻ nhập tay. TikTok và Shopee nhập từ file xuất của sàn."
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
              <>
                <ToolbarLink label="Khách lẻ" icon={Plus} primary to="/orders/create" />
                <ToolbarButton label="Nhập sàn" icon={Upload} onClick={() => setImportOpen(true)} />
              </>
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

      <OrderImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {cards.filter((card) => card.id === "ship_24h" || card.id === "overdue_ship").map((card) => (
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
          const count = rows.filter((order) => order.deskTab === item.id).length;
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

      <div className="overflow-hidden rounded-md border bg-card">
        {pageRows.map((order) => {
          const late = hoursLeft(order.shipBy);
          const open = order.deskTab === "can_lam" || order.deskTab === "can_gui";
          const shipChip = !open || late == null ? null : late < 0 ? "Quá hạn gửi" : late <= 24 ? `Hạn ${vnTime(order.shipBy)}` : null;
          const place = order.shipMode === "pickup" ? "Lấy tại xưởng" : order.shipMode === "tu_giao" ? "Giao" : "Nhãn sàn";
          const photos = (order.customerPhotoCount ?? 0) > 0;
          const first = order.items[0];
          const product = first
            ? `${first.name}${first.variant ? ` · ${first.variant}` : ""} · ×${first.quantity}${order.items.length > 1 ? ` +${order.items.length - 1}` : ""}`
            : "Chưa có sản phẩm";
          const choices = listStatusChoices({ status: order.status, role: me.data?.role === "production" ? "production" : me.data?.role === "sale" ? "sale" : "owner", channel: order.channel });
          const current = (order.status in STATUS_LABEL ? order.status : "nhan_don") as OrderStatus;
          return (
            <div
              key={order.id}
              role="link"
              tabIndex={0}
              className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-3 last:border-b-0 hover:bg-muted/40"
              onClick={() => navigate({ to: "/admin/don-hang/$code", params: { code: order.code } })}
              onKeyDown={(event) => {
                if (event.key === "Enter") navigate({ to: "/admin/don-hang/$code", params: { code: order.code } });
              }}
            >
              <input
                type="checkbox"
                className="size-4 shrink-0"
                aria-label={`Chọn ${order.code}`}
                checked={picked.includes(order.id)}
                onClick={(event) => event.stopPropagation()}
                onChange={() => toggle(order.id)}
              />
              <div className="min-w-0 flex-1 basis-[16rem]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-primary">{order.code}</span>
                  <Chip>{DESK_CHANNEL_LABEL[order.channel]}</Chip>
                  <Chip>{place}</Chip>
                  {shipChip ? <Chip warn={late != null && late < 0}>{shipChip}</Chip> : null}
                  <Chip>{photos ? "Có ảnh" : "Chưa có ảnh"}</Chip>
                </div>
                <p className="mt-1 truncate text-sm">
                  <span className="font-medium">{order.buyerName}</span>
                  <span className="text-muted-foreground"> · {product}</span>
                  {production || order.total == null ? null : <span className="font-semibold"> · {formatMaybe(order.total)}</span>}
                </p>
              </div>
              <select
                className="h-11 w-full rounded-md border bg-background px-2 text-sm font-semibold sm:w-40"
                aria-label={`Trạng thái ${order.code}`}
                value={current}
                disabled={busy === order.id || choices.length === 0}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => requestStatus(order, event.target.value as OrderStatus)}
              >
                <option value={current}>{statusOptionLabel(order, current)}</option>
                {choices.filter((status) => status !== current).map((status) => (
                  <option key={status} value={status}>{statusOptionLabel(order, status)}</option>
                ))}
              </select>
            </div>
          );
        })}
        {orders.data && shown.length === 0 ? <p className="px-3 py-6 text-sm text-muted-foreground">Không có đơn trong bộ lọc này.</p> : null}
      </div>
      <Dialog open={pending != null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending ? `${pending.order.code} · ${STATUS_LABEL[pending.status]}` : "Đổi trạng thái"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{pending?.status === "huy" ? "Hủy đơn cần ghi lý do." : "Mở lại đơn cần ghi lý do."}</p>
          <Input value={reason} placeholder="Lý do" aria-label="Lý do đổi trạng thái" onChange={(event) => setReason(event.target.value)} />
          <Button
            type="button"
            disabled={!reason.trim() || !pending}
            onClick={() => {
              if (!pending) return;
              const next = pending;
              setPending(null);
              void applyStatus(next.order, next.status, reason.trim());
            }}
          >
            Xác nhận
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusOptionLabel(order: Row, status: OrderStatus): string {
  if (status === "xong") return order.shipMode === "pickup" ? "Khách đã nhận" : "Đã giao";
  return STATUS_LABEL[status];
}

function Chip({ children, warn }: { children: string; warn?: boolean }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${warn ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>{children}</span>;
}
