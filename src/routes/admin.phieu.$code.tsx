import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type RefObject } from "react";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { BRAND, formatMaybe } from "@/lib/brand";
import { getOrderDetail, orderUploadLink } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/phieu/$code")({
  validateSearch: (search: Record<string, unknown>): { loai: string } => ({
    loai: search.loai === "sx" ? "sx" : "",
  }),
  component: SlipPage,
});

type Paper = "k80" | "a5" | "a4";

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
  const [paper, setPaper] = useState<Paper>("k80");
  const [qr, setQr] = useState<string | null>(null);
  const [k80Height, setK80Height] = useState(160);
  const sheetRef = useRef<HTMLElement>(null);
  const data = order.data;
  const upload = useQuery({
    queryKey: ["slip-upload", data?.id],
    queryFn: () => orderUploadLink({ data: { orderId: data!.id, rotate: false } }),
    enabled: Boolean(data?.id),
  });
  const designUrl = upload.data?.token ? `${typeof window === "undefined" ? `https://${BRAND.website}` : window.location.origin}/q/don/${upload.data.token}` : "";

  useEffect(() => {
    if (!designUrl) return;
    let cancel = false;
    void import("qrcode").then((QR) =>
      QR.toDataURL(designUrl, {
        width: paper === "k80" ? 180 : 280,
        margin: paper === "k80" ? 0 : 1,
        errorCorrectionLevel: "M",
      }).then((url) => {
        if (!cancel) setQr(url);
      }),
    );
    return () => {
      cancel = true;
    };
  }, [designUrl, paper]);

  useEffect(() => {
    if (paper !== "k80" || !sheetRef.current) return;
    const px = sheetRef.current.scrollHeight;
    const mm = Math.ceil((px * 25.4) / 96) + 8;
    setK80Height(Math.max(90, mm));
  }, [data, paper, qr]);

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

  const pageRule =
    paper === "k80"
      ? `size: 80mm ${k80Height}mm; margin: 2mm;`
      : `size: ${paper === "a5" ? "A5" : "A4"}; margin: 12mm;`;

  return (
    <div className="space-y-4">
      <style>{`
        @page { ${pageRule} }
        @media print {
          header, nav, aside, .no-print { display: none !important; }
          html, body, .admin-desk, main { background: #fff !important; color: #000 !important; }
          main { padding: 0 !important; max-width: none !important; }
          .slip-sheet { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button className="min-h-12" onClick={() => window.print()}>In phiếu</Button>
        {loai === "sx" ? null : (["k80", "a5", "a4"] as const).map((size) => (
          <button
            key={size}
            type="button"
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${paper === size ? "bg-primary text-primary-foreground" : "border bg-card"}`}
            onClick={() => setPaper(size)}
          >
            {size === "k80" ? "K80" : size.toUpperCase()}
          </button>
        ))}
      </div>
      {loai === "sx" ? (
        <ProductionSlip data={data} when={when} />
      ) : paper === "k80" ? (
        <K80Slip sheetRef={sheetRef} pageHeight={k80Height} data={data} when={when} where={where} qr={qr} />
      ) : (
        <OfficeSlip data={data} when={when} where={where} qr={qr} paper={paper} />
      )}
    </div>
  );
}

type SlipData = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

function K80Slip({
  data,
  when,
  where,
  qr,
  sheetRef,
  pageHeight,
}: {
  data: SlipData;
  when: string;
  where: string;
  qr: string | null;
  sheetRef: RefObject<HTMLElement | null>;
  pageHeight: number;
}) {
  return (
    <article
      ref={sheetRef}
      data-k80-height={pageHeight}
      className="slip-sheet mx-auto box-border w-[72mm] bg-white p-1 text-[12px] leading-snug text-black shadow print:shadow-none"
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

function OfficeSlip({
  data,
  when,
  where,
  qr,
  paper,
}: {
  data: SlipData;
  when: string;
  where: string;
  qr: string | null;
  paper: "a5" | "a4";
}) {
  return (
    <article className={`slip-sheet mx-auto box-border bg-white p-6 text-black shadow print:shadow-none ${paper === "a5" ? "max-w-[148mm]" : "max-w-[210mm]"}`}>
      <header className="flex items-start justify-between gap-4 border-b border-black pb-3">
        <div>
          <p className="text-xl font-extrabold leading-tight">Nhà In Thiên Thiên</p>
          <p className="text-sm">{BRAND.website}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold">Phiếu giao nhận</p>
          <p className="font-mono text-sm">{data.code}</p>
          <p className="text-sm font-semibold">{data.channelLabel}</p>
          <p className="text-sm">{when}</p>
        </div>
      </header>
      <section className="mt-4 grid gap-1 text-sm">
        <p><span className="font-semibold">Khách:</span> {data.customerName}</p>
        {data.phone ? <p><span className="font-semibold">Số khách:</span> {data.phone}</p> : null}
        <p><span className="font-semibold">Nơi nhận:</span> {where}</p>
        {data.dueDate ? <p><span className="font-semibold">Ngày hẹn:</span> {data.dueDate.slice(0, 10)}</p> : null}
      </section>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-black text-left">
            <th className="py-1 pr-2 font-semibold">Sản phẩm</th>
            <th className="py-1 pr-2 text-right font-semibold">SL</th>
            <th className="py-1 pr-2 text-right font-semibold">Đơn giá</th>
            <th className="py-1 text-right font-semibold">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id} className="border-b border-black/20">
              <td className="py-1 pr-2">{item.name}</td>
              <td className="py-1 pr-2 text-right">{item.quantity}</td>
              <td className="py-1 pr-2 text-right">{formatMaybe(item.unitPrice)}</td>
              <td className="py-1 text-right">{formatMaybe(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-3 ml-auto w-64 space-y-1 text-sm">
        <Money dt="Tổng hàng" dd={formatMaybe(data.subtotal)} />
        <Money dt="Giảm giá" dd={formatMaybe(data.discount)} />
        <Money dt="Phí giao khách trả" dd={formatMaybe(data.shipping?.customerShip)} />
        <Money dt="COD" dd={formatMaybe(data.shipping?.codAmount)} />
        <Money dt="Đã cọc" dd={formatMaybe(data.depositPaid)} />
        <div className="flex justify-between border-t border-black pt-1 text-base font-extrabold">
          <dt>Còn thu</dt>
          <dd>{formatMaybe(data.remain)}</dd>
        </div>
      </dl>
      {data.customerNote ? <p className="mt-3 text-sm">Ghi chú: {data.customerNote}</p> : null}
      <div className="mt-8 grid grid-cols-[1fr_auto] items-end gap-4">
        <div className="grid grid-cols-2 gap-6 text-center text-sm">
          <div>
            <p className="font-semibold">Người giao</p>
            <p className="mt-16 border-t border-black pt-1 text-xs">Ký, ghi rõ họ tên</p>
          </div>
          <div>
            <p className="font-semibold">Người nhận</p>
            <p className="mt-16 border-t border-black pt-1 text-xs">Ký, ghi rõ họ tên</p>
          </div>
        </div>
        <div className="text-center">
          {qr ? <img src={qr} alt={`Mã gửi ảnh thiết kế ${data.code}`} className="h-28 w-28" /> : <div className="h-28 w-28" />}
          <p className="text-xs font-semibold">Gửi ảnh thiết kế</p>
        </div>
      </div>
    </article>
  );
}

function ProductionSlip({ data, when }: { data: SlipData; when: string }) {
  return (
    <article className="slip-sheet mx-auto box-border w-[72mm] bg-white p-2 text-[12px] leading-snug text-black shadow">
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
