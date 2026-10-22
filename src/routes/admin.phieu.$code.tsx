import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { BRAND, formatMaybe } from "@/lib/brand";
import { getOrderDetail } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/phieu/$code")({
  component: SlipPage,
});

type Paper = "a5" | "a4";

function SlipPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale in phiếu.">
      <SlipBody />
    </RoleGate>
  );
}

function SlipBody() {
  const { code } = Route.useParams();
  const order = useQuery({ queryKey: ["order", code], queryFn: () => getOrderDetail({ data: { code } }) });
  const [paper, setPaper] = useState<Paper>("a5");
  const [qr, setQr] = useState<string | null>(null);
  const data = order.data;

  useEffect(() => {
    if (!data) return;
    const link = `https://${BRAND.website}/tra-cuu?code=${encodeURIComponent(data.code)}`;
    let cancel = false;
    void import("qrcode").then((QR) =>
      QR.toDataURL(link, { width: 280, margin: 1, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancel) setQr(url);
      }),
    );
    return () => {
      cancel = true;
    };
  }, [data]);

  if (order.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (order.isError || !data) return <p className="font-semibold text-destructive">{(order.error as Error)?.message ?? "Không thấy đơn."}</p>;

  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  const where = data.fulfillment === "delivery" ? data.address || "Chưa ghi nơi nhận" : "Nhận tại tiệm";

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: ${paper === "a5" ? "A5" : "A4"}; margin: 12mm; }
          header, nav, aside, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button className="min-h-12" onClick={() => window.print()}>In phiếu</Button>
        {(["a5", "a4"] as const).map((size) => (
          <button
            key={size}
            type="button"
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${paper === size ? "bg-primary text-primary-foreground" : "border bg-card"}`}
            onClick={() => setPaper(size)}
          >
            {size.toUpperCase()}
          </button>
        ))}
      </div>
      <article className={`mx-auto box-border bg-white p-6 text-black shadow print:shadow-none ${paper === "a5" ? "max-w-[148mm]" : "max-w-[210mm]"}`}>
        <header className="flex items-start justify-between gap-4 border-b border-black pb-3">
          <div>
            <p className="text-xl font-extrabold leading-tight">Nhà In Thiên Thiên</p>
            <p className="text-sm">{BRAND.website}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-extrabold">Phiếu giao nhận</p>
            <p className="font-mono text-sm">{data.code}</p>
            <p className="text-sm">Ngày {today}</p>
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
        <dl className="mt-3 ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Tổng hàng</dt><dd>{formatMaybe(data.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Giảm giá</dt><dd>{formatMaybe(data.discount)}</dd></div>
          <div className="flex justify-between"><dt>Phí giao khách trả</dt><dd>{formatMaybe(data.shipping?.customerShip)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Đã cọc</dt><dd>{formatMaybe(data.depositPaid)}</dd></div>
          <div className="flex justify-between border-t border-black pt-1 text-base font-extrabold"><dt>Còn thu</dt><dd>{formatMaybe(data.remain)}</dd></div>
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
          {qr ? <img src={qr} alt={`Mã tra cứu đơn ${data.code}`} className="h-28 w-28" /> : <div className="h-28 w-28" />}
        </div>
      </article>
    </div>
  );
}
