import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { formatMaybe } from "@/lib/brand";
import { getDashboard, punchClock } from "@/lib/admin.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  if (dash.isLoading) return <p className="text-muted-foreground">Đang tải tổng quan…</p>;
  if (dash.isError || !dash.data) return <p className="text-destructive">{(dash.error as Error)?.message ?? "Không tải được."}</p>;
  const data = dash.data;

  async function clock(action: "in" | "out") {
    try {
      await punchClock({ data: { action } });
      toast.success(action === "in" ? "Đã vào ca" : "Đã ra ca");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-primary md:text-3xl">Xin chào, {data.name}</h1>
          <p className="text-sm text-muted-foreground">Giờ làm 8:00–18:00. Chấm công trên điện thoại, không cần vị trí hay ảnh.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button className="min-h-14 flex-1 bg-accent text-accent-foreground text-base" onClick={() => clock("in")} disabled={data.clockedIn}>
            Vào ca
          </Button>
          <Button className="min-h-14 flex-1 text-base" variant="outline" onClick={() => clock("out")} disabled={!data.clockedIn}>
            Ra ca
          </Button>
        </div>
      </div>

      {"revenueToday" in data ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Doanh thu hôm nay" value={formatMaybe(data.revenueToday)} />
          <Card label="Doanh thu tháng" value={formatMaybe(data.revenueMonth)} />
          <Card label="Hòa vốn tháng" value={data.breakevenPercent === null ? "—" : `${data.breakevenPercent}%`} />
          <Card label="Hôm nay còn thiếu" value={formatMaybe(data.todayGap)} />
          <Card label="Lãi gộp tháng" value={data.grossIncomplete ? "Chưa đủ số" : formatMaybe(data.gross)} />
          <Card label="Lợi nhuận tháng" value={data.profit === null ? "Chưa đủ số" : formatMaybe(data.profit)} />
        </section>
      ) : null}

      {"kpiPercent" in data ? (
        <section className="glass-card rounded-3xl p-5">
          <h2 className="text-lg font-bold text-primary">KPI và hoa hồng của bạn</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {data.commissionBasis === "handled"
              ? "Hoa hồng theo doanh thu đơn bạn xử lý. Không hiện giá vốn hay lãi."
              : "Hoa hồng theo doanh thu toàn tiệm. Không hiện số doanh thu, giá vốn hay lãi."}
          </p>
          <p className="mt-3 text-3xl font-extrabold text-accent">{data.kpiPercent === null ? "—" : `${data.kpiPercent}% KPI`}</p>
          <p className="mt-1 text-base font-semibold">Hoa hồng tạm tính: {formatMaybe(data.commission)}</p>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-bold text-primary">Quy trình đơn</h2>
        <p className="mt-1 text-sm text-muted-foreground">Nhận đơn, thiết kế, chờ khách duyệt, in, đóng gói, giao, rồi xong. Đơn hủy không tự mở lại.</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {data.byStatus
            .filter((row) => row.status !== "huy")
            .map((row) => (
              <div key={row.status} className="glass-panel min-w-28 shrink-0 rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-muted-foreground">{row.label}</p>
                <p className="text-2xl font-extrabold text-primary">{row.count}</p>
              </div>
            ))}
          {data.byStatus
            .filter((row) => row.status === "huy")
            .map((row) => (
              <div key={row.status} className="min-w-28 shrink-0 rounded-2xl bg-destructive/10 px-4 py-3">
                <p className="text-xs font-semibold text-destructive">{row.label}</p>
                <p className="text-2xl font-extrabold text-destructive">{row.count}</p>
              </div>
            ))}
        </div>
      </section>

      {"queue" in data ? (
        <OrderBlock title="Đơn cần in / ép / đóng gói" rows={data.queue} />
      ) : null}
      {"orders" in data ? <OrderBlock title="Đơn cần xử lý" rows={data.orders} /> : null}

      <section className="glass-card rounded-3xl p-5">
        <h2 className="text-lg font-bold text-primary">Đơn trễ mốc sàn</h2>
        {data.late.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Không có đơn trễ 14:00 / 18:00.</p> : <OrderList rows={data.late} />}
      </section>

      <section className="glass-card rounded-3xl p-5">
        <h2 className="text-lg font-bold text-primary">Vật tư sắp hết</h2>
        {data.lowStock.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Chưa đặt mức tối thiểu, hoặc chưa có vật tư dưới mức.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {data.lowStock.map((item) => (
              <li key={item.id} className="rounded-xl bg-destructive/10 px-3 py-2 font-semibold text-destructive">
                {item.name}: {item.stock} {item.unit} (tối thiểu {item.min})
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-card rounded-3xl p-5">
        <h2 className="text-lg font-bold text-primary">Đang trong ca</h2>
        {data.onShift.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Chưa ai bấm vào ca.</p>
        ) : (
          <ul className="mt-2 text-sm">
            {data.onShift.map((person) => (
              <li key={person.id}>{person.name}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-3xl p-4">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-primary">{value}</p>
    </div>
  );
}

function OrderBlock({ title, rows }: { title: string; rows: { code: string; itemSummary: string; statusLabel: string; late: boolean }[] }) {
  return (
    <section className="glass-card rounded-3xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-primary">{title}</h2>
        <Link to="/admin/don-hang" className="text-sm font-semibold text-accent">
          Tất cả
        </Link>
      </div>
      <OrderList rows={rows} />
    </section>
  );
}

function OrderList({ rows }: { rows: { code: string; itemSummary: string; statusLabel: string; late: boolean; customerName?: string }[] }) {
  if (!rows.length) return <p className="mt-2 text-sm text-muted-foreground">Chưa có đơn.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row) => (
        <li key={row.code}>
          <Link to="/admin/don-hang/$code" params={{ code: row.code }} className="block rounded-2xl bg-card px-4 py-3">
            <span className="font-bold text-primary">{row.code}</span>
            <span className="ml-2 text-sm">{row.statusLabel}</span>
            {row.late ? <span className="ml-2 text-sm font-bold text-destructive">Trễ mốc</span> : null}
            <p className="text-sm text-muted-foreground">{row.customerName ? `${row.customerName} · ` : ""}{row.itemSummary}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
