import { formatMaybe } from "@/lib/brand";

type Props = {
  total: number | null;
  depositPaid: number;
  remain: number | null;
  className?: string;
};

/** Khối tiền khách thấy trên trang gửi ảnh / tra cứu. */
export function OrderMoney({ total, depositPaid, remain, className }: Props) {
  const totalLabel = formatMaybe(total) === "—" ? "Liên hệ" : formatMaybe(total);
  const paidLabel = formatMaybe(depositPaid);
  const remainLabel = remain === null ? "—" : formatMaybe(remain);
  const owing = remain != null && remain > 0;
  const settled = remain === 0 && total != null;

  return (
    <div className={className ?? "space-y-2 rounded-2xl border border-border/70 bg-muted/40 p-3 text-sm"}>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Tổng đơn</span>
        <span className="font-bold text-foreground">{totalLabel}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-muted-foreground">Đã thanh toán</span>
        <span className="font-semibold text-emerald-700">{paidLabel}</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-border pt-2">
        <span className="font-semibold text-foreground">{settled ? "Đã đủ tiền" : "Còn nợ"}</span>
        <span className={`font-bold ${owing ? "text-destructive" : "text-accent"}`}>{remainLabel}</span>
      </div>
    </div>
  );
}
