import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CircleAlert, LogIn, LogOut, PiggyBank, Target, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { STATUS_TONE } from "@/components/admin/filter-chips";
import { formatMaybe } from "@/lib/brand";
import { getDashboard, punchClock } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

const NO_ALERTS: { code: string; kind: "san" | "tre"; title: string; body: string }[] = [];

function DashboardPage() {
  const queryClient = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const data = dash.data;
  const alerts = data && "alerts" in data ? data.alerts : NO_ALERTS;
  useEffect(() => {
    if (!data) return;
    const badge = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (!alerts.length) {
      void badge.clearAppBadge?.();
      return;
    }
    void badge.setAppBadge?.(alerts.length);
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    const seen = new Set<string>(JSON.parse(localStorage.getItem("tt-desk-alerted") || "[]"));
    const fresh = alerts.filter((item) => !seen.has(`${day}:${item.kind}:${item.code}`));
    for (const item of fresh.slice(0, 3)) {
      seen.add(`${day}:${item.kind}:${item.code}`);
      const payload = { title: item.title, body: item.body, icon: "/brand/icon-192.png", data: { url: `/admin/don-hang/${item.code}` } };
      void navigator.serviceWorker?.ready
        .then((registration) => registration.showNotification(item.title, payload))
        .catch(() => {
          new Notification(item.title, { body: item.body });
        });
    }
    if (fresh.length) localStorage.setItem("tt-desk-alerted", JSON.stringify([...seen].slice(-80)));
  }, [alerts, data]);

  if (!data) {
    return <p className={dash.isError ? "text-destructive" : "text-muted-foreground"}>{dash.isError ? (dash.error as Error).message : "Đang tải tổng quan…"}</p>;
  }

  async function clock(action: "in" | "out") {
    try {
      await punchClock({ data: { action } });
      toast.success(action === "in" ? "Đã vào ca" : "Đã ra ca");
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const hello = greeting();
  const since = data.clockedInAt ? new Date(data.clockedInAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{hello}</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-primary sm:text-2xl">{data.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.clockedIn ? `Đang trong ca${since ? ` từ ${since}` : ""}.` : "Chưa vào ca."} Giờ làm 8:00–18:00. Bấm trên điện thoại, không cần vị trí hay ảnh.
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-primary"
              onClick={() => {
                if (typeof Notification === "undefined") {
                  toast.error("Máy này không hiện được thông báo.");
                  return;
                }
                void Notification.requestPermission().then((permission) => {
                  toast.success(permission === "granted" ? "Đã bật báo khi trang đang mở." : "Chưa bật báo trên máy.");
                });
              }}
            >
              Bật báo trên máy
            </button>
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
      </section>

      {alerts.length > 0 ? (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <h2 className="font-semibold text-primary">Cần xem</h2>
          <p className="mt-1 text-sm text-muted-foreground">Đơn sàn mới trong 36 giờ và đơn quá mốc. Báo hiện khi trang quản trị đang mở.</p>
          <ul className="mt-3 space-y-2">
            {alerts.map((item) => (
              <li key={`${item.kind}-${item.code}`}>
                <Link to="/admin/don-hang/$code" params={{ code: item.code }} className="block rounded-2xl bg-card px-4 py-3">
                  <span className="font-bold text-primary">{item.title}</span>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <h2 className="text-sm font-semibold text-primary">Đơn theo bước</h2>
          <Link to="/admin/don-hang" className="text-sm font-semibold text-primary">Mở bảng đơn</Link>
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
          {data.byStatus.map((row) => {
            const tone = STATUS_TONE[row.status] ?? { color: "#4B5563", icon: Target };
            const Icon = tone.icon;
            return (
              <Link
                key={row.status}
                to="/admin/don-hang"
                search={{ status: row.status }}
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
              </Link>
            );
          })}
        </div>
      </section>

      {"revenueToday" in data ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Card label="Doanh thu hôm nay" value={formatMaybe(data.revenueToday)} hint="Đơn đã xong" icon={Wallet} tone="bg-blue-500/10 text-blue-700" />
          <Card label="Doanh thu tháng" value={formatMaybe(data.revenueMonth)} hint={data.breakevenPercent === null ? "Chưa đặt mốc hòa vốn" : `${data.breakevenPercent}% mốc hòa vốn`} icon={CalendarDays} tone="bg-emerald-500/10 text-emerald-700" />
          <Card label="Hôm nay còn thiếu" value={formatMaybe(data.todayGap)} hint="So với mốc hòa vốn ngày" icon={CircleAlert} tone="bg-orange-500/10 text-orange-700" />
          <Card label="Lãi gộp tháng" value={data.grossIncomplete ? "Chưa đủ số" : formatMaybe(data.gross)} hint="Giá bán trừ vật tư, mực, phí kênh" icon={TrendingUp} tone="bg-teal-500/10 text-teal-700" />
          <Card label="Lợi nhuận tháng" value={data.profit === null ? "Chưa đủ số" : formatMaybe(data.profit)} hint="Lãi gộp trừ chi phí" icon={PiggyBank} tone="bg-violet-500/10 text-violet-700" />
        </section>
      ) : null}

      {"kpiPercent" in data ? (
        <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-primary">KPI và hoa hồng của bạn</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.commissionBasis === "handled"
              ? "Hoa hồng theo doanh thu đơn bạn xử lý. Không hiện giá vốn hay lãi."
              : "Hoa hồng theo doanh thu toàn tiệm. Không hiện số doanh thu, giá vốn hay lãi."}
          </p>
          <p className="mt-3 text-3xl font-semibold text-primary">{data.kpiPercent === null ? "—" : `${data.kpiPercent}% KPI`}</p>
          <p className="mt-1 text-base font-semibold">Hoa hồng tạm tính: {formatMaybe(data.commission)}</p>
          <Link to="/admin/kpi" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Xem KPI tháng</Link>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <div className="space-y-4">
          {"queue" in data ? <OrderBlock title="Việc in, ép, đóng gói" rows={data.queue} /> : null}
          {"orders" in data ? <OrderBlock title="Đơn mới nhất" rows={data.orders} /> : null}
        </div>
        <div className="space-y-4">
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="font-semibold text-primary">Đơn trễ mốc sàn</h2>
            {data.late.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Không có đơn trễ 14:00 / 18:00.</p> : <OrderList rows={data.late} />}
          </section>
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-primary">Vật tư sắp hết</h2>
              <Link to="/admin/kho" className="text-sm font-semibold text-primary">Kho</Link>
            </div>
            {data.lowStock.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Chưa đặt mức tối thiểu, hoặc chưa có vật tư dưới mức.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {data.lowStock.slice(0, 8).map((item) => (
                  <li key={item.id} className="rounded-xl bg-destructive/10 px-3 py-2 font-semibold text-destructive">
                    {item.name}: {item.stock} {item.unit} (tối thiểu {item.min})
                  </li>
                ))}
                {data.lowStock.length > 8 ? <li className="text-muted-foreground">Còn {data.lowStock.length - 8}. Mở kho để lọc.</li> : null}
              </ul>
            )}
          </section>
          <section className="rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-primary">Đang trong ca</h2>
              <Link to="/admin/cham-cong" className="text-sm font-semibold text-primary">Bảng công</Link>
            </div>
            {data.onShift.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Chưa ai bấm vào ca.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {data.onShift.map((person) => (
                  <li key={person.id}>{person.name}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function Card({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: LucideIcon; tone: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-sans text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-primary sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function OrderBlock({ title, rows }: { title: string; rows: { code: string; itemSummary: string; statusLabel: string; late: boolean }[] }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
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
  const shown = rows.slice(0, 8);
  return (
    <ul className="mt-3 space-y-2">
      {shown.map((row) => (
        <li key={row.code}>
          <Link to="/admin/don-hang/$code" params={{ code: row.code }} className="block rounded-2xl bg-card px-4 py-3">
            <span className="font-bold text-primary">{row.code}</span>
            <span className="ml-2 text-sm">{row.statusLabel}</span>
            {row.late ? <span className="ml-2 text-sm font-bold text-destructive">Trễ mốc</span> : null}
            <p className="text-sm text-muted-foreground">{row.customerName ? `${row.customerName} · ` : ""}{row.itemSummary}</p>
          </Link>
        </li>
      ))}
      {rows.length > shown.length ? <li className="text-sm text-muted-foreground">Còn {rows.length - shown.length}. Mở danh sách để lọc.</li> : null}
    </ul>
  );
}
