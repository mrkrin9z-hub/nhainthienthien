import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CARRIER_NAME, carrierIdFromName, waybillBlock, type CarrierId } from "@/domain/carriers";
import { createCarrierWaybill, getCarrierDesk, quoteCarrierFee, refreshCarrierWaybill } from "@/lib/admin.functions";

const control = "min-h-12 w-full rounded-2xl border border-border bg-card px-3 text-sm";

export function WaybillBox({
  orderId,
  channel,
  status,
  fulfillment,
  address,
  carrier,
  tracking,
  carrierStatus,
  codAmount,
  onDone,
}: {
  orderId: string;
  channel: string;
  status: string;
  fulfillment: string;
  address: string;
  carrier: string;
  tracking: string;
  carrierStatus: string;
  codAmount: number | null;
  onDone: () => Promise<void>;
}) {
  const desk = useQuery({ queryKey: ["carrier-desk"], queryFn: () => getCarrierDesk() });
  const [busy, setBusy] = useState(false);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [ward, setWard] = useState("");
  const [street, setStreet] = useState(address);
  const [weight, setWeight] = useState("500");
  const queryClient = useQueryClient();
  const block = waybillBlock({ channel, status, fulfillment, tracking: "" });
  const connected = (["ghn", "ghtk", "jt"] as const).filter((id) => desk.data?.[id]);
  const preferred = connected.find((id) => CARRIER_NAME[id] === carrier.trim()) ?? connected[0] ?? "ghn";
  const [choice, setChoice] = useState<CarrierId | "">("");
  const selected = choice || preferred;

  async function after(message: string) {
    toast.success(message);
    await queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    await onDone();
  }

  if (channel === "tiktok" || channel === "shopee") {
    return <p className="text-xs text-muted-foreground">Đơn sàn lấy vận đơn từ sàn. Ghi mã bằng tay nếu sàn chưa đổ.</p>;
  }
  if (block === "Đơn này không giao đi.") return null;

  if (tracking.trim()) {
    if (!carrierIdFromName(carrier)) {
      return carrierStatus ? <p className="text-sm">Trạng thái hãng: {carrierStatus}</p> : null;
    }
    return (
      <div className="space-y-2">
        {carrierStatus ? <p className="text-sm">Trạng thái hãng: {carrierStatus}</p> : null}
        <Button
          id="waybill-refresh"
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await refreshCarrierWaybill({ data: { orderId } });
              await after(result.status);
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Đang hỏi hãng…" : "Cập nhật trạng thái"}
        </Button>
      </div>
    );
  }

  if (block) return <p className="text-xs text-muted-foreground">{block}</p>;
  if (desk.isLoading) return <p className="text-xs text-muted-foreground">Đang xem khóa hãng…</p>;
  if (!connected.length) {
    return <p className="text-xs text-muted-foreground">Chưa lưu khóa GHN, GHTK hoặc J&T. Vào Kết nối để dán khóa. Chưa có khóa thì ghi mã bằng tay.</p>;
  }

  const payload = {
    orderId,
    carrier: selected as CarrierId,
    province,
    district,
    ward,
    address: street,
    weightGrams: Number(weight),
    codAmount: codAmount ?? 0,
  };

  return (
    <div className="space-y-2 border-t border-border/70 pt-3">
      <p className="text-xs text-muted-foreground">
        Tạo vận đơn chỉ khi bấm nút. Phí do tiệm trả. Tiền thu hộ lấy theo ô COD. GHTK có thể xem phí trước.
      </p>
      <select id="waybill-carrier" className={control} value={selected} onChange={(event) => setChoice(event.target.value as CarrierId)}>
        {connected.map((id) => (
          <option key={id} value={id}>
            {CARRIER_NAME[id]}
          </option>
        ))}
      </select>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input id="waybill-province" className="min-h-12" placeholder="Tỉnh/thành người nhận" value={province} onChange={(event) => setProvince(event.target.value)} />
        <Input id="waybill-district" className="min-h-12" placeholder="Quận/huyện, bỏ trống nếu địa chỉ 2 cấp" value={district} onChange={(event) => setDistrict(event.target.value)} />
        <Input id="waybill-ward" className="min-h-12" placeholder="Phường/xã" value={ward} onChange={(event) => setWard(event.target.value)} />
        <Input className="min-h-12" inputMode="numeric" placeholder="Khối lượng (gram)" value={weight} onChange={(event) => setWeight(event.target.value.replace(/[^\d]/g, ""))} />
      </div>
      <Input id="waybill-address" className="min-h-12" placeholder="Địa chỉ giao" value={street} onChange={(event) => setStreet(event.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button
          id="waybill-create"
          type="button"
          className="min-h-11"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await createCarrierWaybill({ data: payload });
              const fee = result.fee === null ? "" : ` Phí ${result.fee.toLocaleString("vi-VN")}đ.`;
              await after(`Đã tạo vận đơn ${result.tracking}.${fee}`);
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Đang tạo…" : "Tạo vận đơn"}
        </Button>
        {selected === "ghtk" ? (
          <Button
            id="waybill-quote"
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await quoteCarrierFee({ data: payload });
                toast.success(`GHTK báo phí ${result.fee.toLocaleString("vi-VN")}đ. Chưa tạo vận đơn.`);
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Xem phí GHTK
          </Button>
        ) : null}
      </div>
    </div>
  );
}
