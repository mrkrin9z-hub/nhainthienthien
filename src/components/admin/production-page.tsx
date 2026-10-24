import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { DESK_CHANNEL_LABEL, PRODUCTION_LANES, productionLane, productionMove, type ProductionLane } from "@/domain/order-desk";
import type { Channel } from "@/domain/types";
import { changeStatus, getMe, getOrders } from "@/lib/admin.functions";


const LANE_TONE: Record<ProductionLane, string> = {
  chua: "bg-slate-100",
  in: "bg-sky-50",
  goi: "bg-amber-50",
  giao: "bg-emerald-50",
};

function lineText(item: { quantity: number; name: string; variant?: string }): string {
  return `${item.quantity}× ${item.name}${item.variant ? ` · ${item.variant}` : ""}`;
}

function dueText(value: string | null): string {
  if (!value) return "Chưa hạn";
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return value;
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

export function ProductionPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => getOrders() });
  const client = useQueryClient();
  const [q, setQ] = useState("");
  const [lane, setLane] = useState<ProductionLane | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const role = me.data?.role === "sale" || me.data?.role === "production" ? me.data.role : "owner";
  const queue = (orders.data?.orders ?? []).filter((order) => productionLane(order.status));
  const needle = q.trim().toLowerCase();
  const rows = queue.filter((order) => {
    if (lane !== "all" && productionLane(order.status) !== lane) return false;
    if (!needle) return true;
    return `${order.code} ${order.channelLabel} ${order.itemSummary}`.toLowerCase().includes(needle);
  });
  const list = useListPage(rows, `${q}|${lane}`);
  const shown = lane === "all" ? rows : list.slice;

  async function move(orderId: string, status: "nhan_don" | "thiet_ke" | "cho_duyet" | "in" | "dong_goi" | "giao" | "xong") {
    setBusy(orderId);
    const previous = client.getQueryData<typeof orders.data>(["orders"]);
    client.setQueryData(["orders"], (current: typeof orders.data) => {
      if (!current) return current;
      return { ...current, orders: current.orders.map((order) => (order.id === orderId ? { ...order, status } : order)) };
    });
    try {
      await changeStatus({ data: { orderId, status, note: "" } });
    } catch (error) {
      if (previous) client.setQueryData(["orders"], previous);
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
      await client.invalidateQueries({ queryKey: ["orders"] });
    }
  }

  return (
    <div className="space-y-4 bg-slate-50">
      <PageToolbar
        title="Sản xuất"
        hint="Lệnh sản xuất lấy từ Đơn hàng. Một nút chuyển bước kế, trạng thái đơn đổi theo."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã, hàng…"
      />
      <div className="flex gap-2 overflow-x-auto md:hidden">
        <button type="button" className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold ${lane === "all" ? "bg-blue-600 text-white" : "bg-white"}`} onClick={() => setLane("all")}>
          Tất cả {queue.length}
        </button>
        {PRODUCTION_LANES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold ${lane === item.id ? "bg-blue-600 text-white" : "bg-white"}`}
            onClick={() => setLane(item.id)}
          >
            {item.label} {queue.filter((order) => productionLane(order.status) === item.id).length}
          </button>
        ))}
      </div>
      {lane !== "all" ? (
        <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="đơn" onPage={list.setPage} />
      ) : null}
      <div className={lane === "all" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-4" : "grid gap-3"}>
        {(lane === "all" ? PRODUCTION_LANES : PRODUCTION_LANES.filter((item) => item.id === lane)).map((column) => {
          const cards = (lane === "all" ? rows : shown).filter((order) => productionLane(order.status) === column.id);
          return (
            <section key={column.id} className={`rounded-2xl p-2 ${LANE_TONE[column.id]}`}>
              <header className="flex items-center justify-between px-1 py-2">
                <h2 className="text-sm font-semibold">{column.label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {queue.filter((order) => productionLane(order.status) === column.id).length}
                </span>
              </header>
              <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
                {cards.map((order) => {
                  const step = productionMove({ status: order.status, role, channel: order.channel });
                  const channel = DESK_CHANNEL_LABEL[order.channel as Channel] ?? order.channelLabel;
                  const due = order.dueDate || order.shipBy;
                  return (
                    <article key={order.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="font-mono text-sm font-semibold text-blue-700">
                          {order.code}
                        </Link>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{channel}</span>
                      </div>
                      <ul className="space-y-0.5 text-sm text-slate-700">
                        {(order.items.length ? order.items : [{ id: order.id, quantity: 1, name: order.itemSummary || "Chưa có hàng", variant: "" }]).map((item) => (
                          <li key={item.id}>{lineText(item)}</li>
                        ))}
                      </ul>
                      <p className="text-xs text-slate-500">Hạn {dueText(due)}</p>
                      <div className="flex gap-2">
                        {step.back ? (
                          <button
                            type="button"
                            disabled={busy === order.id}
                            className="min-h-11 rounded-xl border px-3 text-sm font-semibold"
                            onClick={() => void move(order.id, step.back!)}
                          >
                            {step.backLabel}
                          </button>
                        ) : null}
                        {step.next ? (
                          <button
                            type="button"
                            disabled={busy === order.id}
                            className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white"
                            onClick={() => void move(order.id, step.next!)}
                          >
                            {step.nextLabel}
                          </button>
                        ) : (
                          <p className="self-center text-xs text-slate-400">Bước này chờ vai khác.</p>
                        )}
                      </div>
                    </article>
                  );
                })}
                {cards.length === 0 ? <p className="px-2 py-6 text-center text-sm text-slate-400">Không có đơn</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
