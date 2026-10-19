import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { OrderDesk, type DeskSku } from "@/components/admin/order-desk";
import { OrderQrDialog } from "@/components/admin/order-qr-dialog";
import { WaybillBox } from "@/components/admin/waybill-box";
import { canPreviewPhoto, PhotoViewer, saveStaffFile, saveStaffFiles, staffThumb } from "@/components/photo-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMaybe } from "@/lib/brand";
import { changeStatus, getMe, getOrderDetail, getSkuOptions, recordDeposit, reviseOrder, saveNote, saveReprint, storeShipping } from "@/lib/admin.functions";
import { isMergedWoodAlias, isProductionStep, PRODUCTION_STEPS } from "@/domain/calc";
import { marketplaceEditLocked } from "@/domain/order-edit";
import { JT_CARRIER, jtOrder } from "@/domain/jt";
import { CHANNEL_LABEL, STATUS_LABEL, type OrderStatus } from "@/domain/types";

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
  const [qrOpen, setQrOpen] = useState(false);
  const [tab, setTab] = useState("thong-tin");
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [savingFiles, setSavingFiles] = useState(false);
  const skus = useQuery({ queryKey: ["sku-options"], queryFn: () => getSkuOptions(), enabled: me.data?.role !== "production" });
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
      <div className="flex gap-1 overflow-x-auto border-b">
        {(
          [
            ["thong-tin", "Thông tin"],
            ["khach", "Khách hàng"],
            ["anh", "Hình ảnh"],
            ["giao", "Giao hàng"],
            ["trang-thai", "Tình trạng"],
            ["lich-su", "Lịch sử"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "thong-tin" ? (
        role === "production" ? (
          <section className="rounded-md border bg-card p-4">
            <h2 className="font-semibold text-primary">Sản phẩm</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.items.map((item) => (
                <li key={item.id}>
                  {item.quantity}× {item.name}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <OrderDesk
            key={data.id}
            mode="edit"
            owner={role === "owner"}
            fieldsLocked={marketplaceEditLocked(data.channel)}
            itemsLocked={marketplaceEditLocked(data.channel) || data.printDeducted || data.packDeducted || data.status === "xong" || data.status === "huy"}
            lockNote={
              marketplaceEditLocked(data.channel)
                ? "Đơn TikTok hoặc Shopee lấy từ sàn. Khách, sản phẩm, giá và thu tiền bị khóa."
                : data.status === "xong" || data.status === "huy"
                  ? "Đơn đã hủy hoặc đã xong. Mở lại ở tab Tình trạng rồi mới sửa sản phẩm."
                  : data.printDeducted || data.packDeducted
                    ? "Đơn đã trừ kho. Lùi về trước bước In rồi mới sửa sản phẩm. Tên, số và địa chỉ vẫn lưu được."
                    : ""
            }
            catalog={((skus.data ?? []) as DeskSku[]).filter((sku) => !isMergedWoodAlias(sku) || data.items.some((item) => item.skuId === sku.id))}
            paidSoFar={data.depositPaid ?? 0}
            initial={{
              channel: data.channel,
              fullName: data.customerName,
              phone: data.phone,
              address: data.address,
              fulfillment: data.fulfillment,
              note: data.customerNote,
              dueDate: data.dueDate ? data.dueDate.slice(0, 10) : "",
              marketplaceCode: data.marketplaceCode,
              lines: data.items.map((item) => ({
                key: item.id,
                skuId: item.skuId,
                quantity: item.quantity,
                unitPrice: item.unitPrice === null ? "" : String(item.unitPrice),
              })),
            }}
            onSave={async (value) => {
              await reviseOrder({
                data: {
                  orderId: data.id,
                  fullName: value.fullName,
                  phone: value.phone,
                  address: value.address,
                  fulfillment: value.fulfillment,
                  note: value.note,
                  dueDate: value.dueDate,
                  ...(value.items ? { items: value.items } : {}),
                },
              });
              toast.success("Đã cập nhật đơn");
              await refresh();
            }}
            onCollect={async (amount, payMethod) => {
              await recordDeposit({ data: { orderId: data.id, amount, method: payMethod } });
              toast.success("Đã ghi tiền");
              await refresh();
            }}
          />
        )
      ) : null}

      {tab === "khach" ? (
        <section className="rounded-md border bg-card p-4">
          <h2 className="font-semibold text-primary">Khách hàng</h2>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Tên</dt>
              <dd className="text-base font-semibold">{data.customerName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Số điện thoại</dt>
              <dd className="text-base font-semibold">{data.phone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kênh</dt>
              <dd>{CHANNEL_LABEL[data.channel]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nhận hàng</dt>
              <dd>{data.fulfillment === "delivery" ? "Giao hàng" : "Tại tiệm"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-muted-foreground">Địa chỉ</dt>
              <dd>{data.address || "Chưa có địa chỉ"}</dd>
            </div>
            {data.customerNote ? (
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">Ghi chú khách</dt>
                <dd>{data.customerNote}</dd>
              </div>
            ) : null}
          </dl>
          {role === "production" ? null : (
            <Link to="/admin/khach/$id" params={{ id: data.customerId }} className="mt-3 inline-block text-sm font-semibold text-primary">
              Hồ sơ khách
            </Link>
          )}
        </section>
      ) : null}

      {tab === "giao" ? (
        role !== "production" ? (
          <ShippingForm
            orderId={data.id}
            shipping={data.shipping}
            channel={data.channel}
            source={data.source}
            fulfillment={data.fulfillment}
            status={data.status}
            address={data.address}
            onDone={refresh}
          />
        ) : (
          <p className="text-sm">
            Hãng: {data.shipping?.carrier || "chưa ghi"} · Vận đơn: {data.shipping?.tracking || "chưa có"}
            {data.shipping?.carrierStatus ? ` · ${data.shipping.carrierStatus}` : ""}
          </p>
        )
      ) : null}

      {tab === "trang-thai" ? (
      <>
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
        <section className="mt-4 rounded-md border bg-card p-4">
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
      </>
      ) : null}

      {tab === "anh" ? (
      <>
      <section className="rounded-md border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-primary">Hình ảnh</h2>
          <div className="flex flex-wrap gap-2">
            {data.files.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={savingFiles}
                onClick={() => {
                  setSavingFiles(true);
                  void saveStaffFiles(
                    data.files.map((file) => ({ id: file.id, name: file.name })),
                    `${data.code}-anh.zip`,
                  )
                    .then(() => toast.success(data.files.length > 1 ? "Đã tải một file zip về máy." : "Đã tải file về máy."))
                    .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Không tải được file."))
                    .finally(() => setSavingFiles(false));
                }}
              >
                {savingFiles ? "Đang tải…" : "Tải tất cả về máy"}
              </Button>
            ) : null}
            {role !== "production" && data.status !== "huy" ? (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setQrOpen(true)}>
                Mã QR gửi khách
              </Button>
            ) : null}
          </div>
        </div>
        {data.files.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Chưa có file.</p> : null}
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {data.files.filter((file) => canPreviewPhoto(file)).map((file) => (
            <li key={file.id}>
              <button type="button" className="block w-full overflow-hidden rounded-2xl border border-border bg-muted text-left" onClick={() => setOpenFile(file.id)}>
                <img src={staffThumb(file.id)} alt={file.name} className="aspect-square w-full object-cover" />
                <span className="block truncate px-2 pt-1 text-xs font-semibold">{file.name}</span>
                <span className="block truncate px-2 pb-2 text-[11px] text-muted-foreground">{FILE_KIND[file.kind] ?? file.kind}</span>
              </button>
            </li>
          ))}
        </ul>
        <ul className="mt-2 space-y-2 text-sm">
          {data.files.filter((file) => !canPreviewPhoto(file)).map((file) => (
            <li key={file.id}>
              <button type="button" className="font-semibold text-primary" onClick={() => void saveStaffFile(file.id, file.name).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Không tải được file."))}>
                {file.name}
              </button>
              <span className="text-muted-foreground"> · {FILE_KIND[file.kind] ?? file.kind}</span>
            </li>
          ))}
        </ul>
      </section>
      {openFile ? (
        <PhotoViewer
          src={staffThumb(openFile, true)}
          name={data.files.find((file) => file.id === openFile)?.name ?? "Ảnh"}
          downloadHref={`/api/staff/file/${openFile}`}
          onClose={() => setOpenFile(null)}
        />
      ) : null}
      {qrOpen ? <OrderQrDialog open={qrOpen} onOpenChange={setQrOpen} orderId={data.id} code={data.code} /> : null}
      </>
      ) : null}

      {tab === "trang-thai" && role !== "production" ? (
        <section className="rounded-md border bg-card p-4">
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

      {tab === "trang-thai" && role === "owner" && data.quote ? (
        <section className="rounded-md border bg-card p-4">
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

      {tab === "lich-su" ? (
      <section className="rounded-md border bg-card p-4">
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
  status,
  address,
  onDone,
}: {
  orderId: string;
  shipping?: { carrier: string; tracking: string; shipFee: number | null; codAmount: number | null; carrierStatus?: string };
  channel: string;
  source: string;
  fulfillment: string;
  status: string;
  address: string;
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
          Đơn web giao tận nơi và đơn Facebook mặc định J&T Express. Có khóa thì bấm Tạo vận đơn. Chưa có khóa thì ghi mã và phí bằng tay. Tem in khổ 100×150.
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
      <WaybillBox
        orderId={orderId}
        channel={channel}
        status={status}
        fulfillment={fulfillment}
        address={address}
        carrier={carrier}
        tracking={tracking}
        carrierStatus={shipping?.carrierStatus ?? ""}
        codAmount={codAmount === "" ? null : Number(codAmount)}
        onDone={onDone}
      />
    </section>
  );
}
