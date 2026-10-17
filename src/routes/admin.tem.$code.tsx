import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { code128Widths } from "@/domain/barcode";
import { formatMaybe } from "@/lib/brand";
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

function LabelBody() {
  const { code } = Route.useParams();
  const order = useQuery({ queryKey: ["order", code], queryFn: () => getOrderDetail({ data: { code } }) });
  if (order.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (order.isError || !order.data) return <p className="font-semibold text-destructive">{(order.error as Error)?.message ?? "Không thấy đơn."}</p>;
  const data = order.data;
  if (data.channel !== "tai_tiem" && data.channel !== "facebook") {
    return <p className="text-lg font-semibold text-primary">Đơn sàn này in tem của TikTok hoặc Shopee.</p>;
  }
  const cod = data.shipping?.codAmount;
  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          @page { size: 100mm 150mm; margin: 0; }
          header, nav, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; }
          body { background: white !important; }
        }
      `}</style>
      <div className="no-print">
        <Button className="min-h-12" onClick={() => window.print()}>In tem</Button>
      </div>
      <article className="label-sheet mx-auto box-border flex h-[150mm] w-[100mm] flex-col gap-2 bg-white p-3 text-black shadow">
        <p className="text-lg font-extrabold leading-tight">Nhà In Thiên Thiên</p>
        <p className="text-xs uppercase tracking-wide">Người nhận</p>
        <p className="text-base font-bold leading-tight">{data.customerName}</p>
        <p className="text-sm">{data.phone}</p>
        <p className="text-sm leading-snug">{data.address || "Nhận tại tiệm"}</p>
        <p className="text-sm font-bold">Đơn {data.code}</p>
        <p className="text-sm font-bold">COD: {cod ? formatMaybe(cod) : "Không thu hộ"}</p>
        <p className="text-xs leading-snug">{data.itemSummary}</p>
        <div className="mt-auto">
          <Barcode text={data.code} />
          <p className="text-center font-mono text-sm">{data.code}</p>
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
