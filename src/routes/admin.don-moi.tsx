import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDeskOrder, getSkuOptions } from "@/lib/admin.functions";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";

export const Route = createFileRoute("/admin/don-moi")({
  component: NewOrderPage,
});

function NewOrderPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <NewOrderBody />
    </RoleGate>
  );
}

function NewOrderBody() {
  const router = useRouter();
  const skus = useQuery({ queryKey: ["sku-options"], queryFn: () => getSkuOptions() });
  const [channel, setChannel] = useState<Channel>("tai_tiem");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [marketplaceCode, setMarketplaceCode] = useState("");
  const [skuId, setSkuId] = useState("");
  const [quantity, setQuantity] = useState(1);

  return (
    <form
      className="mx-auto max-w-xl space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          const result = await createDeskOrder({
            data: {
              channel,
              fullName,
              phone,
              address,
              fulfillment,
              note,
              dueDate: dueDate || null,
              marketplaceCode,
              items: [{ skuId, quantity }],
            },
          });
          toast.success(`Đã tạo ${result.code}`);
          router.navigate({ to: "/admin/don-hang/$code", params: { code: result.code } });
        } catch (error) {
          toast.error((error as Error).message);
        }
      }}
    >
      <h1 className="text-2xl font-extrabold text-primary">Ghi đơn</h1>
      <p className="text-sm text-muted-foreground">Giá lấy theo kênh. Sale không sửa giá. Chủ sửa trên đơn sau khi tạo nếu cần.</p>
      <Label>Kênh</Label>
      <select className="min-h-12 w-full rounded-xl border bg-background px-3" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
        {(Object.keys(CHANNEL_LABEL) as Channel[]).map((item) => (
          <option key={item} value={item}>
            {CHANNEL_LABEL[item]}
          </option>
        ))}
      </select>
      <Label>Khách</Label>
      <Input className="min-h-12" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      <Label>Số điện thoại</Label>
      <Input className="min-h-12" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      <Label>Nhận hàng</Label>
      <select className="min-h-12 w-full rounded-xl border bg-background px-3" value={fulfillment} onChange={(e) => setFulfillment(e.target.value as "pickup" | "delivery")}>
        <option value="pickup">Tại tiệm</option>
        <option value="delivery">Giao hàng</option>
      </select>
      <Label>Địa chỉ</Label>
      <Input className="min-h-12" value={address} onChange={(e) => setAddress(e.target.value)} />
      <Label>Mã đơn sàn (TikTok / Shopee)</Label>
      <Input className="min-h-12" value={marketplaceCode} onChange={(e) => setMarketplaceCode(e.target.value)} />
      <Label>Hẹn giao</Label>
      <Input className="min-h-12" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <Label>Sản phẩm</Label>
      <select className="min-h-12 w-full rounded-xl border bg-background px-3" value={skuId} onChange={(e) => setSkuId(e.target.value)} required>
        <option value="">Chọn SKU</option>
        {(skus.data ?? []).map((sku) => (
          <option key={sku.id} value={sku.id}>
            {sku.label}
            {sku.price === null ? " · chưa có giá" : ""}
          </option>
        ))}
      </select>
      <Label>Số lượng combo / gói</Label>
      <Input className="min-h-12" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
      <Label>Ghi chú</Label>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      <Button type="submit" className="min-h-12 w-full bg-accent text-accent-foreground">
        Lưu đơn
      </Button>
    </form>
  );
}
