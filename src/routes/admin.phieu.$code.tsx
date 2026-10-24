import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { BRAND, formatMaybe } from "@/lib/brand";
import { customerUploadPath } from "@/domain/order-upload";
import { getOrderDetail, orderUploadLink } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/phieu/$code")({
  validateSearch: (search: Record<string, unknown>): { loai: string } => ({
    loai: search.loai === "sx" ? "sx" : "",
  }),
  component: SlipPage,
});

function SlipPage() {
  return (
    <RoleGate allow={["owner", "sale", "production"]} deny="Chỉ chủ, sale và sản xuất in phiếu.">
      <SlipBody />
    </RoleGate>
  );
}

function SlipBody() {
  const { code } = Route.useParams();
  const { loai } = Route.useSearch();
  const order = useQuery({ queryKey: ["order", code], queryFn: () => getOrderDetail({ data: { code } }) });
  const [qr, setQr] = useState<string | null>(null);
  const data = order.data;
  const upload = useQuery({
    queryKey: ["slip-upload", data?.id],
    queryFn: () => orderUploadLink({ data: { orderId: data!.id, rotate: false } }),
    enabled: Boolean(data?.id),
  });
  const designUrl = upload.data?.slug ? `${typeof window === "undefined" ? `https://${BRAND.website}` : window.location.origin}${customerUploadPath(upload.data.slug)}` : "";

  useEffect(() => {
    if (!designUrl) return;
    let cancel = false;
    void import("qrcode").then((QR) =>
      QR.toDataURL(designUrl, {
        width: 180,
        margin: 0,
        errorCorrectionLevel: "M",
      }).then((url) => {
        if (!cancel) setQr(url);
      }),
    );
    return () => {
      cancel = true;
    };
  }, [designUrl]);

  if (order.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (order.isError || !data) return <p className="font-semibold text-destructive">{(order.error as Error)?.message ?? "Không thấy đơn."}</p>;

  const when = new Date(data.createdAt).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const where = data.fulfillment === "delivery" ? data.address || "Chưa ghi nơi nhận" : "Nhận tại tiệm";

  return (
    <div className="space-y-4">
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body {
            width: 80mm !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #000 !important;
          }
          .admin-desk, .admin-desk > div, main {
            display: block !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          header, nav, aside, .no-print { display: none !important; }
          .k80-frame {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .slip-sheet {
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button className="min-h-12" onClick={() => window.print()}>{loai === "sx" ? "In phiếu sản xuất" : "In bill K80"}</Button>
        <p className="text-sm text-muted-foreground">Khổ in 80mm. Phần chữ rộng 72mm, vừa vùng in của máy nhiệt USB.</p>
      </div>
      <div className="k80-frame mx-auto box-border w-[80mm] bg-neutral-200 px-[4mm] py-[2mm] print:bg-white">
        {loai === "sx" ? <ProductionSlip data={data} when={when} qr={qr} /> : <K80Slip data={data} when={when} where={where} qr={qr} />}
      </div>
    </div>
  );
}

type SlipData = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

function K80Slip({
  data,
  when,
  where,
  qr,
}: {
  data: SlipData;
  when: string;
  where: string;
  qr: string | null;
}) {
  return (
    <article
      className="slip-sheet mx-auto box-border w-[72mm] bg-white px-0 py-[2mm] text-[12px] leading-snug text-black shadow print:shadow-none"
      style={{ fontFamily: '"Be Vietnam Pro", ui-sans-serif, system-ui, sans-serif' }}
    >
      <header className="border-b border-black pb-2 text-center">
        <p className="text-[15px] font-extrabold tracking-wide">NHÀ IN THIÊN THIÊN</p>
        <p className="text-[11px]">{BRAND.website}</p>
        <p className="mt-1 text-[13px] font-extrabold">Phiếu giao nhận</p>
        <p className="font-mono text-[12px] font-bold">{data.code}</p>
        <p className="text-[12px] font-semibold">{data.channelLabel}</p>
        <p>{when}</p>
      </header>
      <section className="mt-2 space-y-0.5">
        <p><span className="font-semibold">Khách:</span> {data.customerName}</p>
        {data.phone ? <p><span className="font-semibold">Số khách:</span> {data.phone}</p> : null}
        <p className="break-words"><span className="font-semibold">Nơi nhận:</span> {where}</p>
        {data.dueDate ? <p><span className="font-semibold">Ngày hẹn:</span> {data.dueDate.slice(0, 10)}</p> : null}
      </section>
      <div className="mt-2 border-t border-black">
        {data.items.map((item) => (
          <div key={item.id} className="border-b border-black py-1">
            <p className="break-words font-semibold">{item.name}</p>
            <div className="flex justify-between gap-2">
              <span>{item.quantity} × {formatMaybe(item.unitPrice)}</span>
              <span className="font-semibold">{formatMaybe(item.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <dl className="mt-2 space-y-0.5">
        <Money dt="Tổng hàng" dd={formatMaybe(data.subtotal)} />
        <Money dt="Giảm giá" dd={formatMaybe(data.discount)} />
        <Money dt="Phí giao khách trả" dd={formatMaybe(data.shipping?.customerShip)} />
        <Money dt="COD" dd={formatMaybe(data.shipping?.codAmount)} />
        <Money dt="Đã cọc" dd={formatMaybe(data.depositPaid)} />
        <div className="flex justify-between border-t border-black pt-1 text-[14px] font-extrabold">
          <dt>Còn thu</dt>
          <dd>{formatMaybe(data.remain)}</dd>
        </div>
      </dl>
      {data.customerNote ? <p className="mt-2 break-words">Ghi chú: {data.customerNote}</p> : null}
      <div className="mt-3 text-center">
        {qr ? <img src={qr} alt={`Mã gửi ảnh thiết kế ${data.code}`} className="mx-auto h-[28mm] w-[28mm]" /> : null}
        <p className="text-[11px] font-semibold">Gửi ảnh thiết kế</p>
        <p className="mt-2 font-semibold">Cảm ơn anh/chị.</p>
      </div>
    </article>
  );
}

function ProductionSlip({ data, when, qr }: { data: SlipData; when: string; qr: string | null }) {
  return (
    <article className="slip-sheet mx-auto box-border w-[72mm] bg-white px-0 py-[2mm] text-[12px] leading-snug text-black shadow print:shadow-none">
      <header className="border-b border-black pb-2 text-center">
        <p className="text-[15px] font-extrabold">NHÀ IN THIÊN THIÊN</p>
        <p className="mt-1 text-[13px] font-extrabold">Phiếu sản xuất</p>
        <p className="font-mono font-bold">{data.code}</p>
        <p>{data.channelOrderId || data.channelLabel}</p>
        <p>{when}</p>
      </header>
      <ul className="mt-2 space-y-2">
        {data.items.map((item) => (
          <li key={item.id} className="border-b border-black pb-1">
            <p className="font-semibold">{item.sellerSku || item.skuCode}</p>
            <p>{item.name}{item.variant ? ` · ${item.variant}` : ""}</p>
            <p>Số lượng: {item.quantity}</p>
          </li>
        ))}
      </ul>
      {data.customerNote ? <p className="mt-2">Ghi chú: {data.customerNote}</p> : null}
      <div className="mt-2 text-center">
        {qr ? <img src={qr} alt={`Mã gửi ảnh thiết kế ${data.code}`} className="mx-auto h-24 w-24" /> : null}
        <p className="text-[11px] font-semibold">Khách gửi ảnh</p>
      </div>
    </article>
  );
}

function Money({ dt, dd }: { dt: string; dd: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{dt}</dt>
      <dd className="text-right">{dd}</dd>
    </div>
  );
}
