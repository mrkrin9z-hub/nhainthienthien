import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { code128Widths } from "@/domain/barcode";
import { jtOrder } from "@/domain/jt";
import { BRAND, formatMaybe } from "@/lib/brand";
import { getOrderDetail } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tem/$code")({
  component: LabelPage,
});

function LabelPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale in tem.">
      <LabelBody />
    </RoleGate>
  );
}

const LABEL_SIZES = {
  "100x150": { label: "100×150", page: "100mm 150mm", box: "h-[150mm] w-[100mm]" },
  "75x100": { label: "75×100", page: "75mm 100mm", box: "h-[100mm] w-[75mm]" },
} as const;

function LabelBody() {
  const { code } = Route.useParams();
  const order = useQuery({ queryKey: ["order", code], queryFn: () => getOrderDetail({ data: { code } }) });
  const [size, setSize] = useState<keyof typeof LABEL_SIZES>("100x150");
  const [qr, setQr] = useState<string | null>(null);
  const data = order.data;
  useEffect(() => {
    if (!data) return;
    let cancel = false;
    void import("qrcode").then((QR) =>
      QR.toDataURL(data.code, { width: 180, margin: 0, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancel) setQr(url);
      }),
    );
    return () => {
      cancel = true;
    };
  }, [data]);
  if (order.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (order.isError || !data) return <p className="font-semibold text-destructive">{(order.error as Error)?.message ?? "Không thấy đơn."}</p>;
  if (data.channel !== "tai_tiem" && data.channel !== "facebook") {
    return <p className="text-lg font-semibold text-primary">Đơn sàn này in tem của TikTok hoặc Shopee.</p>;
  }
  const sheet = LABEL_SIZES[size];
  const cod = data.shipping?.codAmount;
  const jt = jtOrder({ channel: data.channel, source: data.source, fulfillment: data.fulfillment });
  const today = new Date().toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: ${sheet.page}; margin: 0; }
          header, nav, aside, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center gap-2">
        <Button className="min-h-12" onClick={() => window.print()}>In tem</Button>
        {(Object.keys(LABEL_SIZES) as (keyof typeof LABEL_SIZES)[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${size === id ? "bg-primary text-primary-foreground" : "border bg-card"}`}
            onClick={() => setSize(id)}
          >
            {LABEL_SIZES[id].label}
          </button>
        ))}
      </div>
      <article className={`label-sheet mx-auto box-border flex flex-col gap-2 bg-white p-3 text-black shadow ${sheet.box}`}>
        <p className="text-lg font-extrabold leading-tight">Nhà In Thiên Thiên</p>
        <p className="text-xs">{BRAND.website} · {today}</p>
        {jt ? <p className="text-sm font-extrabold tracking-wide">J&T Express</p> : null}
        <p className="text-xs uppercase tracking-wide">Người nhận</p>
        <p className="text-base font-bold leading-tight">{data.customerName}</p>
        <p className="text-sm">{data.phone}</p>
        <p className="text-sm leading-snug">{data.address || "Nhận tại tiệm"}</p>
        <p className="text-sm font-bold">Đơn {data.code}</p>
        {jt ? <p className="text-sm font-bold">Vận đơn: {data.shipping?.tracking || "chưa có"}</p> : null}
        <p className="text-sm font-bold">COD: {cod ? formatMaybe(cod) : "Không thu hộ"}</p>
        <p className="text-xs leading-snug">{data.itemSummary}</p>
        <div className="mt-auto flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Barcode text={data.code} />
            <p className="text-center font-mono text-sm">{data.code}</p>
          </div>
          {qr ? <img src={qr} alt={`Mã QR ${data.code}`} className="h-16 w-16 shrink-0" /> : null}
        </div>
      </article>
    </div>
  );
}

function Barcode({ text }: { text: string }) {
  let widths: number[] = [];
  try {
    widths = code128Widths(text);
  } catch {
    return null;
  }
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  let ink = true;
  for (const width of widths) {
    if (ink) bars.push({ x, w: width });
    x += width;
    ink = !ink;
  }
  return (
    <svg viewBox={`0 0 ${x} 42`} className="h-16 w-full" role="img" aria-label={`Mã vạch ${text}`}>
      {bars.map((bar) => (
        <rect key={`${bar.x}-${bar.w}`} x={bar.x} y="0" width={bar.w} height="42" fill="#000" />
      ))}
    </svg>
  );
}
