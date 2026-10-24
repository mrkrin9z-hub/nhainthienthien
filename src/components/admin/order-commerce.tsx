import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isMarketplace, PAYMENT_METHODS, shipModeLabel, type PaymentMethod, type ShipMode } from "@/domain/order-desk";
import { saveOrderCommerce } from "@/lib/admin.functions";
import { formatMaybe } from "@/lib/brand";

type Line = { id: string; name: string; skuCode: string; sellerSku: string; variant: string; quantity: number };

export type CommerceOrder = {
  id: string;
  code: string;
  channel: string;
  channelOrderId: string;
  shipBy: string | null;
  autoCancelAt: string | null;
  shipMode: ShipMode;
  paymentMethod: string;
  netAmount: number | null;
  netStored: boolean;
  designFileUrl: string;
  deskIssue: string | null;
  carrier: string;
  tracking: string;
  customerNote: string;
  items: Line[];
};

function localInput(iso: string | null): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function toIso(value: string): string | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export function OrderCommercePanel({ order, money }: { order: CommerceOrder; money: boolean }) {
  const queryClient = useQueryClient();
  const marketplace = isMarketplace(order.channel);
  const [channelOrderId, setChannelOrderId] = useState(order.channelOrderId);
  const [shipBy, setShipBy] = useState(localInput(order.shipBy));
  const [autoCancelAt, setAutoCancelAt] = useState(localInput(order.autoCancelAt));
  const [shipMode, setShipMode] = useState<ShipMode>(order.shipMode);
  const [carrier, setCarrier] = useState(order.carrier);
  const [tracking, setTracking] = useState(order.tracking);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>((order.paymentMethod as PaymentMethod) || "");
  const [netAmount, setNetAmount] = useState(order.netStored && order.netAmount != null ? String(order.netAmount) : "");
  const [designFileUrl, setDesignFileUrl] = useState(order.designFileUrl);
  const [deskIssue, setDeskIssue] = useState(order.deskIssue ?? "");
  const [note, setNote] = useState(order.customerNote);
  const [lines, setLines] = useState(order.items.map((item) => ({ id: item.id, sellerSku: item.sellerSku || "", variant: item.variant || "" })));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveOrderCommerce({
        data: {
          orderId: order.id,
          channelOrderId,
          shipBy: toIso(shipBy),
          autoCancelAt: toIso(autoCancelAt),
          paymentMethod,
          netAmount: netAmount.trim() === "" ? null : Number(netAmount),
          designFileUrl,
          shipMode,
          deskIssue: deskIssue as "" | "giao_that_bai" | "tra_hang",
          carrier,
          tracking,
          customerNote: note,
          items: lines,
        },
      });
      toast.success("Đã lưu thông tin kênh");
      await queryClient.invalidateQueries({ queryKey: ["order", order.code] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-primary">Kênh và giao hàng</h2>
        <p className="text-xs text-muted-foreground">{marketplace ? "Nhập tay theo đơn sàn. Chưa nối API." : "Bán lẻ và Facebook do shop giao hoặc khách lấy tại xưởng."}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          <Label>Mã đơn kênh</Label>
          <Input className="mt-1" value={channelOrderId} onChange={(event) => setChannelOrderId(event.target.value)} placeholder={marketplace ? "Mã TikTok hoặc Shopee" : "Không có với bán lẻ"} />
        </label>
        <label className="text-sm">
          <Label>Cách giao</Label>
          {marketplace ? (
            <Input className="mt-1" value={shipModeLabel("san")} readOnly />
          ) : (
            <select className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm" value={shipMode} onChange={(event) => setShipMode(event.target.value as ShipMode)}>
              <option value="pickup">Lấy tại xưởng</option>
              <option value="tu_giao">Tự giao</option>
            </select>
          )}
        </label>
        <label className="text-sm">
          <Label>Hạn gửi</Label>
          <Input className="mt-1" type="datetime-local" value={shipBy} onChange={(event) => setShipBy(event.target.value)} />
        </label>
        <label className="text-sm">
          <Label>Tự hủy</Label>
          <Input className="mt-1" type="datetime-local" value={autoCancelAt} onChange={(event) => setAutoCancelAt(event.target.value)} />
        </label>
        <label className="text-sm">
          <Label>Hãng vận chuyển</Label>
          <Input className="mt-1" value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="J&T, SPX, nhãn sàn…" />
        </label>
        <label className="text-sm">
          <Label>Mã vận đơn</Label>
          <Input className="mt-1" value={tracking} onChange={(event) => setTracking(event.target.value)} />
        </label>
        {money ? (
          <>
            <label className="text-sm">
              <Label>Thanh toán</Label>
              <select className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                <option value="">Chưa chọn</option>
                {PAYMENT_METHODS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <Label>Thực nhận sau phí</Label>
              <Input className="mt-1" inputMode="numeric" value={netAmount} placeholder={order.netAmount == null ? "Tự tính khi để trống" : formatMaybe(order.netAmount)} onChange={(event) => setNetAmount(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
          </>
        ) : null}
        <label className="text-sm md:col-span-2">
          <Label>Link ảnh thiết kế (Drive)</Label>
          <Input className="mt-1" value={designFileUrl} onChange={(event) => setDesignFileUrl(event.target.value)} placeholder="https://drive.google.com/…" />
        </label>
        <label className="text-sm">
          <Label>Vấn đề đơn</Label>
          <select className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-sm" value={deskIssue} onChange={(event) => setDeskIssue(event.target.value)}>
            <option value="">Không</option>
            <option value="giao_that_bai">Giao không thành công</option>
            <option value="tra_hang">Trả hàng / Hoàn tiền</option>
          </select>
        </label>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">SKU người bán</p>
        {order.items.map((item) => {
          const line = lines.find((row) => row.id === item.id);
          return (
            <div key={item.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1fr_10rem_10rem]">
              <p className="text-sm">{item.quantity}× {item.name}<span className="block text-xs text-muted-foreground">{item.skuCode}</span></p>
              <Input aria-label={`SKU sàn ${item.skuCode}`} value={line?.sellerSku ?? ""} placeholder="SKU sàn" onChange={(event) => setLines((current) => current.map((row) => row.id === item.id ? { ...row, sellerSku: event.target.value } : row))} />
              <Input aria-label={`Phân loại ${item.skuCode}`} value={line?.variant ?? ""} placeholder="Phân loại" onChange={(event) => setLines((current) => current.map((row) => row.id === item.id ? { ...row, variant: event.target.value } : row))} />
            </div>
          );
        })}
      </div>
      <label className="block text-sm">
        <Label>Ghi chú khách</Label>
        <Textarea className="mt-1" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <Button type="button" disabled={busy} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu thông tin kênh"}</Button>
    </section>
  );
}
