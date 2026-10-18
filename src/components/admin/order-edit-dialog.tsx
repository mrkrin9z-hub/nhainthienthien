import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isMergedWoodAlias } from "@/domain/calc";
import type { Channel } from "@/domain/types";
import { getSkuOptions, reviseOrder } from "@/lib/admin.functions";

type SkuOption = {
  id: string;
  code: string;
  name: string;
  groupName: string;
  label: string;
  prices?: Partial<Record<Channel, number | null>>;
};

type Line = { key: string; skuId: string; quantity: string; unitPrice: string };

const control = "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

export function OrderEditDialog({
  open,
  onOpenChange,
  owner,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  owner: boolean;
  order: {
    id: string;
    code: string;
    channel: Channel;
    customerName: string;
    phone: string;
    address: string;
    fulfillment: "pickup" | "delivery";
    customerNote: string;
    dueDate: string | null;
    status: string;
    printDeducted: boolean;
    packDeducted: boolean;
    items: { id: string; skuId: string; name: string; quantity: number; unitPrice: number | null }[];
  };
}) {
  const queryClient = useQueryClient();
  const skus = useQuery({ queryKey: ["sku-options"], queryFn: () => getSkuOptions(), enabled: open });
  const catalog = ((skus.data ?? []) as SkuOption[]).filter((sku) => !isMergedWoodAlias(sku) || order.items.some((item) => item.skuId === sku.id));
  const locked = order.printDeducted || order.packDeducted || order.status === "xong" || order.status === "huy";
  const [name, setName] = useState(order.customerName);
  const [phone, setPhone] = useState(order.phone);
  const [address, setAddress] = useState(order.address);
  const [fulfillment, setFulfillment] = useState(order.fulfillment);
  const [note, setNote] = useState(order.customerNote);
  const [dueDate, setDueDate] = useState(order.dueDate ?? "");
  const [lines, setLines] = useState<Line[]>(
    order.items.map((item) => ({
      key: item.id,
      skuId: item.skuId,
      quantity: String(item.quantity),
      unitPrice: item.unitPrice === null ? "" : String(item.unitPrice),
    })),
  );
  const [saving, setSaving] = useState(false);

  function patch(key: string, next: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...next } : line)));
  }

  async function save() {
    setSaving(true);
    try {
      const items = locked
        ? undefined
        : lines.map((line) => {
            const quantity = Number(line.quantity);
            const price = line.unitPrice.trim() === "" ? null : Number(line.unitPrice);
            return {
              skuId: line.skuId,
              quantity,
              ...(price === null ? {} : { unitPrice: price }),
            };
          });
      await reviseOrder({
        data: {
          orderId: order.id,
          fullName: name,
          phone,
          address,
          fulfillment,
          note,
          dueDate: dueDate || null,
          ...(items ? { items } : {}),
        },
      });
      toast.success("Đã sửa đơn");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["order", order.code] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa đơn {order.code}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Tên khách
            <Input className="mt-1 min-h-11" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Số điện thoại
            <Input className="mt-1 min-h-11" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold sm:col-span-2">
            Địa chỉ
            <Input className="mt-1 min-h-11" value={address} onChange={(event) => setAddress(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Nhận hàng
            <select className={`${control} mt-1`} value={fulfillment} onChange={(event) => setFulfillment(event.target.value as "pickup" | "delivery")}>
              <option value="pickup">Lấy tại tiệm</option>
              <option value="delivery">Giao tận nơi</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">
            Hẹn giao
            <Input className="mt-1 min-h-11" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold sm:col-span-2">
            Ghi chú khách
            <Textarea className="mt-1" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Sản phẩm</p>
            {locked ? null : (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setLines((current) => [...current, { key: crypto.randomUUID(), skuId: "", quantity: "1", unitPrice: "" }])}>
                Thêm dòng
              </Button>
            )}
          </div>
          {locked ? (
            <p className="text-sm text-muted-foreground">
              {order.status === "xong" || order.status === "huy"
                ? "Đơn đã hủy hoặc đã xong. Mở lại đơn rồi mới sửa."
                : "Đơn đã trừ kho. Lùi về trước bước In rồi mới sửa sản phẩm. Tên, số và địa chỉ vẫn lưu được."}
            </p>
          ) : null}
          {lines.map((line, index) => {
            const sku = catalog.find((item) => item.id === line.skuId);
            const listed = sku?.prices?.[order.channel] ?? null;
            return (
              <div key={line.key} className="grid gap-2 rounded-xl border p-3">
                <Label>Dòng {index + 1}</Label>
                <select
                  className={control}
                  value={line.skuId}
                  disabled={locked}
                  aria-label={`Sản phẩm dòng ${index + 1}`}
                  onChange={(event) => {
                    const next = catalog.find((item) => item.id === event.target.value);
                    const nextPrice = next?.prices?.[order.channel];
                    patch(line.key, { skuId: event.target.value, unitPrice: nextPrice == null ? "" : String(nextPrice) });
                  }}
                >
                  <option value="">Chọn sản phẩm</option>
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <Input className="min-h-11" inputMode="numeric" aria-label={`Số lượng dòng ${index + 1}`} value={line.quantity} disabled={locked} onChange={(event) => patch(line.key, { quantity: event.target.value.replace(/\D/g, "") })} />
                  <Input
                    className="min-h-11"
                    inputMode="numeric"
                    aria-label={`Đơn giá dòng ${index + 1}`}
                    placeholder={listed === null ? "Chưa có giá" : String(listed)}
                    value={line.unitPrice}
                    disabled={locked || !owner}
                    onChange={(event) => patch(line.key, { unitPrice: event.target.value.replace(/\D/g, "") })}
                  />
                </div>
                {locked || lines.length < 2 ? null : (
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                    Xóa dòng
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <Button className="min-h-12 w-full" disabled={saving} onClick={() => void save()}>
          {saving ? "Đang lưu…" : "Lưu đơn"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
