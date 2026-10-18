import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CircleAlert, LogIn, LogOut, PiggyBank, Target, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { STATUS_TONE } from "@/components/admin/filter-chips";
import { formatMaybe } from "@/lib/brand";
import { getDashboard, punchClock } from "@/lib/admin.functions";

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
      <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">Xin chào, {data.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Giờ làm 8:00–18:00. Chấm công trên điện thoại, không cần vị trí hay ảnh.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground active:scale-[0.97] disabled:opacity-50 sm:flex-none"
            onClick={() => clock("in")}
            disabled={data.clockedIn}
          >
            <LogIn className="size-4" />
            Vào ca
          </button>
          <button
            type="button"
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border bg-background px-4 text-sm font-medium active:scale-[0.97] disabled:opacity-50 sm:flex-none"
            onClick={() => clock("out")}
            disabled={!data.clockedIn}
          >
            <LogOut className="size-4" />
            Ra ca
          </button>
        </div>
      </div>

      {"revenueToday" in data ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Doanh thu hôm nay" value={formatMaybe(data.revenueToday)} icon={Wallet} tone="bg-blue-500/10 text-blue-700" />
          <Card label="Doanh thu tháng" value={formatMaybe(data.revenueMonth)} icon={CalendarDays} tone="bg-emerald-500/10 text-emerald-700" />
          <Card label="Hòa vốn tháng" value={data.breakevenPercent === null ? "—" : `${data.breakevenPercent}%`} icon={Target} tone="bg-amber-500/10 text-amber-700" />
          <Card label="Hôm nay còn thiếu" value={formatMaybe(data.todayGap)} icon={CircleAlert} tone="bg-orange-500/10 text-orange-700" />
          <Card label="Lãi gộp tháng" value={data.grossIncomplete ? "Chưa đủ số" : formatMaybe(data.gross)} icon={TrendingUp} tone="bg-teal-500/10 text-teal-700" />
          <Card label="Lợi nhuận tháng" value={data.profit === null ? "Chưa đủ số" : formatMaybe(data.profit)} icon={PiggyBank} tone="bg-violet-500/10 text-violet-700" />
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
        <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-none pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {data.byStatus.map((row) => {
            const tone = STATUS_TONE[row.status] ?? { color: "#4B5563", icon: Target };
            const Icon = tone.icon;
            return (
              <div
                key={row.status}
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold"
                style={{ borderColor: "transparent", backgroundColor: `${tone.color}18`, color: tone.color }}
              >
                <Icon className="size-3.5" />
                <span>{row.label}</span>
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                  style={{ backgroundColor: `${tone.color}28`, color: tone.color }}
                >
                  {row.count}
                </span>
              </div>
            );
          })}
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

function Card({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-sans text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-primary sm:text-2xl">{value}</p>
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
