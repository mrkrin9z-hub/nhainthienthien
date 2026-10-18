import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { OrderEditDialog } from "@/components/admin/order-edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMaybe } from "@/lib/brand";
import { changeStatus, getMe, getOrderDetail, recordDeposit, saveNote, saveReprint, storeShipping } from "@/lib/admin.functions";
import { isProductionStep, PRODUCTION_STEPS } from "@/domain/calc";
import { JT_CARRIER, jtOrder } from "@/domain/jt";
import { STATUS_LABEL, type OrderStatus } from "@/domain/types";

export const Route = createFileRoute("/admin/don-hang/$code")({
  component: OrderDetailPage,
});

const NEXT: OrderStatus[] = ["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong", "huy"];
const FILE_KIND: Record<string, string> = {
  original: "Ảnh gốc",
  design: "Thiết kế",
  approval: "Duyệt",
  packing_video: "Video đóng gói",
};

function OrderDetailPage() {
  const { code } = Route.useParams();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const order = useQuery({ queryKey: ["order", code], queryFn: () => getOrderDetail({ data: { code } }) });
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState("chuyển khoản");
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const data = order.data;
  const role = me.data?.role;
  const closed = data?.status === "huy" || data?.status === "xong";
  const productionCanMove = Boolean(data && role === "production" && isProductionStep(data.status));

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["order", code] });
  }

  if (!data) return <p className="text-muted-foreground">{order.isError ? (order.error as Error).message : "Đang tải đơn…"}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-primary">{data.code}</h1>
        <div className="flex flex-wrap gap-2">
          {role !== "production" ? (
            <Button className="min-h-11" onClick={() => setEditing(true)}>Sửa đơn</Button>
          ) : null}
          {role !== "production" && (data.channel === "tai_tiem" || data.channel === "facebook") ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link to="/admin/tem/$code" params={{ code: data.code }}>In tem 100×150</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <p className="break-words text-sm">
        {data.customerName} · {data.phone} · {data.channelLabel} · {data.statusLabel}
        {data.recipientName && data.recipientName !== data.customerName ? ` · Người nhận: ${data.recipientName}` : ""}
        {data.late ? <strong className="text-destructive"> · Trễ mốc</strong> : null}
      </p>
      {data.address ? <p className="break-words text-sm">Địa chỉ: {data.address}</p> : null}
      {data.marketplaceCode ? <p className="text-sm">Mã sàn: {data.marketplaceCode}</p> : null}
      {data.stockWarning ? <p className="rounded-2xl bg-accent/30 px-3 py-2 text-sm font-semibold">{data.stockWarning}</p> : null}
      <p className="text-xs text-muted-foreground">
        Kho in: {data.printDeducted ? "đã trừ" : "chưa trừ"} · Kho đóng gói: {data.packDeducted ? "đã trừ" : "chưa trừ"}
      </p>

      {role !== "production" ? (
        <ShippingForm
          orderId={data.id}
          shipping={data.shipping}
          channel={data.channel}
          source={data.source}
          fulfillment={data.fulfillment}
          onDone={refresh}
        />
      ) : (
        <p className="text-sm">Hãng: {data.shipping?.carrier || "chưa ghi"} · Vận đơn: {data.shipping?.tracking || "chưa có"}</p>
      )}

      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Sản phẩm</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span>
                {item.quantity}× {item.name}
              </span>
              {role === "production" ? null : (
                <span className="text-right">
                  {item.lineTotal === null ? "Chưa có giá" : formatMaybe(item.lineTotal)}
                  {item.listUnitPrice != null && item.lineTotal != null ? (
                    <span className="block text-xs font-normal text-muted-foreground">
                      Niêm yết {formatMaybe(item.listUnitPrice * item.quantity)} · Lệch {formatMaybe(item.lineTotal - item.listUnitPrice * item.quantity)}
                    </span>
                  ) : null}
                </span>
              )}
            </li>
          ))}
        </ul>
        {role === "production" ? null : data.total !== null ? (
          <p className="mt-2 font-bold">Tổng {formatMaybe(data.total)}</p>
        ) : (
          <p className="mt-2 text-sm">Chưa đủ giá bán để ra tổng.</p>
        )}
      </section>

      {role !== "production" ? (
        <section className="glass-card rounded-3xl p-4">
          <h2 className="font-bold text-primary">Cọc</h2>
          <p className="text-sm">
            {data.depositRequired === null
              ? "Cần cọc 50% nhưng chưa có giá bán để tính số tiền."
              : `Cần cọc ${formatMaybe(data.depositRequired)} · Đã ghi ${formatMaybe(data.depositPaid)} ${data.depositMethod}`}
          </p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <Input className="min-h-12 w-full sm:w-36" inputMode="numeric" placeholder="Số tiền" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/\D/g, ""))} />
            <Input className="min-h-12 w-full sm:w-40" value={method} onChange={(e) => setMethod(e.target.value)} />
            <Button
              className="min-h-12"
              onClick={async () => {
                try {
                  await recordDeposit({ data: { orderId: data.id, amount: Number(deposit), method } });
                  toast.success("Đã ghi cọc");
                  setDeposit("");
                  await refresh();
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            >
              Ghi nhận
            </Button>
          </div>
        </section>
      ) : null}

      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Quy trình</h2>
        {data.status === "huy" ? (
          <p className="mt-2 text-sm font-semibold text-destructive">Đơn đang Hủy. Chỉ chủ mở lại, và phải ghi lý do.</p>
        ) : (
          <ol className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong"] as OrderStatus[]).map((status, index) => (
              <li
                key={status}
                className={`min-w-24 shrink-0 rounded-2xl px-3 py-2 text-center text-xs font-bold ${data.status === status ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}
              >
                {index + 1}. {STATUS_LABEL[status]}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Chuyển bước</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {role === "production"
            ? productionCanMove
              ? "Sản xuất chỉ chuyển đơn đang In, Đóng gói hoặc Giao giữa ba bước đó. Vào In thì trừ vật tư in. Sang Giao thì trừ túi, xốp, carton, băng keo, tem."
              : "Đơn này không nằm ở In, Đóng gói hoặc Giao. Sản xuất không chuyển bước."
            : closed && role === "owner"
              ? "Mở lại đơn đã hủy hoặc đã xong cần ghi lý do. Lý do được lưu vào lịch sử."
              : closed
                ? "Đơn đã hủy hoặc đã xong. Chỉ chủ mở lại, và phải ghi lý do."
                : "Vào In thì trừ vật tư in. Sang Giao thì trừ túi, xốp, carton, băng keo, tem."}
        </p>
        {role === "owner" ? (
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Chủ bỏ qua điều kiện cọc
          </label>
        ) : null}
        {role === "owner" && closed ? (
          <Textarea className="mt-2" placeholder="Lý do mở lại" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {(role === "production" ? (productionCanMove ? [...PRODUCTION_STEPS] : []) : closed && role !== "owner" ? [] : NEXT).map((status) => (
            <Button
              key={status}
              variant={data.status === status ? "default" : "outline"}
              className="min-h-12 w-full sm:w-auto"
              onClick={async () => {
                const reopening = closed && status !== data.status;
                if (reopening && !reopenReason.trim()) {
                  toast.error("Mở lại đơn đã hủy hoặc đã xong cần ghi lý do.");
                  return;
                }
                try {
                  await changeStatus({
                    data: { orderId: data.id, status, note: reopening ? reopenReason.trim() : "", ownerOverride: override },
                  });
                  toast.success(STATUS_LABEL[status]);
                  if (reopening) setReopenReason("");
                  await refresh();
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            >
              {STATUS_LABEL[status]}
            </Button>
          ))}
        </div>
        <div className="mt-3 rounded-2xl bg-background p-3 text-sm">
          <p>{data.reply}</p>
          <Button
            variant="outline"
            className="mt-2 min-h-11"
            onClick={() => {
              void navigator.clipboard.writeText(data.reply);
              toast.success("Đã chép câu trả lời");
            }}
          >
            Chép câu trả lời
          </Button>
        </div>
      </section>

      {role !== "production" ? (
        <section className="glass-card rounded-3xl p-4">
          <h2 className="font-bold text-primary">Ghi chú nội bộ</h2>
          <Textarea className="mt-2" value={note ?? data.internalNote} onChange={(e) => setNote(e.target.value)} />
          <Button
            className="mt-2 min-h-11"
            variant="outline"
            onClick={async () => {
              try {
                await saveNote({ data: { orderId: data.id, note: note ?? data.internalNote } });
                toast.success("Đã lưu ghi chú");
                await refresh();
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            Lưu ghi chú
          </Button>
        </section>
      ) : null}

      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Ảnh khách</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {data.files.map((file) => (
            <li key={file.id}>
              <a className="font-semibold text-primary" href={`/api/staff/file/${file.id}`}>
                {file.name}
              </a>
              <span className="text-muted-foreground"> · {FILE_KIND[file.kind] ?? file.kind}</span>
            </li>
          ))}
          {data.files.length === 0 ? <li className="text-muted-foreground">Chưa có file.</li> : null}
        </ul>
      </section>

      {role !== "production" ? (
        <section className="glass-card rounded-3xl p-4">
          <h2 className="font-bold text-primary">In lại</h2>
          <p className="text-sm text-muted-foreground">Trong 3 ngày sau khi giao, in lại nếu lỗi do xưởng. Quá hạn web sẽ cảnh báo.</p>
          <Textarea className="mt-2" placeholder="Lý do khách báo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <Button
              className="min-h-11"
              onClick={async () => {
                await saveReprint({ data: { orderId: data.id, reason, decision: "reprint", extraCost: null, uses: [] } });
                toast.success("Đã ghi in lại");
                setReason("");
                await refresh();
              }}
            >
              In lại
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={async () => {
                await saveReprint({ data: { orderId: data.id, reason, decision: "reject", extraCost: null, uses: [] } });
                toast.success("Đã từ chối");
                await refresh();
              }}
            >
              Từ chối
            </Button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {data.reprints.map((item) => (
              <li key={item.id}>
                {item.decision === "reprint" ? "In lại" : item.decision === "reject" ? "Từ chối" : "Chờ"} · {item.reason}
                {item.overdue ? <strong className="text-destructive"> · Quá hạn in lại</strong> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {role === "owner" && data.quote ? (
        <section className="glass-card rounded-3xl p-4">
          <h2 className="font-bold text-primary">Lãi gộp theo định mức hiện tại</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.quote.map((quote, index) =>
              quote ? (
                <li key={index}>
                  {quote.profit === null ? "Chưa đủ số" : `${formatMaybe(quote.profit)} (${quote.marginPercent}%)`}
                  {quote.tone === "red" ? " · LỖ" : quote.tone === "yellow" ? " · dưới ngưỡng vàng" : ""}
                </li>
              ) : null,
            )}
          </ul>
        </section>
      ) : null}

      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Lịch sử</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.history.map((item, index) => (
            <li key={index}>
              {new Date(item.at).toLocaleString("vi-VN")} · {item.toLabel} · {item.byName}
              {item.note ? ` · ${item.note}` : ""}
            </li>
          ))}
        </ul>
      </section>
      {role !== "production" ? (
        <Link to="/admin/khach/$id" params={{ id: data.customerId }} className="text-sm font-semibold text-accent">
          Hồ sơ khách
        </Link>
      ) : null}
      {editing && role !== "production" ? (
        <OrderEditDialog
          open
          onOpenChange={setEditing}
          owner={role === "owner"}
          order={{
            id: data.id,
            code: data.code,
            channel: data.channel,
            customerName: data.customerName,
            phone: data.phone,
            address: data.address,
            fulfillment: data.fulfillment,
            customerNote: data.customerNote,
            dueDate: data.dueDate,
            status: data.status,
            printDeducted: data.printDeducted,
            packDeducted: data.packDeducted,
            items: data.items,
          }}
        />
      ) : null}
    </div>
  );
}

function ShippingForm({
  orderId,
  shipping,
  channel,
  source,
  fulfillment,
  onDone,
}: {
  orderId: string;
  shipping?: { carrier: string; tracking: string; shipFee: number | null; codAmount: number | null };
  channel: string;
  source: string;
  fulfillment: string;
  onDone: () => Promise<void>;
}) {
  const jt = jtOrder({ channel, source, fulfillment });
  const [carrier, setCarrier] = useState(shipping?.carrier || (jt ? JT_CARRIER : ""));
  const [tracking, setTracking] = useState(shipping?.tracking ?? "");
  const [shipFee, setShipFee] = useState(shipping?.shipFee === null || shipping?.shipFee === undefined ? "" : String(shipping.shipFee));
  const [codAmount, setCodAmount] = useState(shipping?.codAmount === null || shipping?.codAmount === undefined ? "" : String(shipping.codAmount));
  return (
    <section className="glass-card space-y-2 rounded-3xl p-4">
      <h2 className="font-bold text-primary">Giao hàng</h2>
      {jt ? (
        <p className="text-xs text-muted-foreground">
          Đơn web giao tận nơi và đơn Facebook đi J&T Express. Chưa có khóa thì ghi mã vận đơn và phí bằng tay. Tem in khổ 100×150.
        </p>
      ) : null}
      <Input className="min-h-12" placeholder="Hãng vận chuyển" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
      <Input className="min-h-12" placeholder="Mã vận đơn" value={tracking} onChange={(e) => setTracking(e.target.value)} />
      <Input className="min-h-12" inputMode="numeric" placeholder="Phí ship" value={shipFee} onChange={(e) => setShipFee(e.target.value.replace(/[^\d]/g, ""))} />
      <Input className="min-h-12" inputMode="numeric" placeholder="Tiền thu hộ COD" value={codAmount} onChange={(e) => setCodAmount(e.target.value.replace(/[^\d]/g, ""))} />
      <Button
        className="min-h-11"
        onClick={async () => {
          try {
            await storeShipping({
              data: {
                orderId,
                carrier,
                tracking,
                shipFee: shipFee === "" ? null : Number(shipFee),
                codAmount: codAmount === "" ? null : Number(codAmount),
              },
            });
            toast.success("Đã lưu giao hàng");
            await onDone();
          } catch (error) {
            toast.error((error as Error).message);
          }
        }}
      >
        Lưu giao hàng
      </Button>
    </section>
  );
}
