import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ALL_TONE, CHANNEL_TONE, FilterChips, STATUS_TONE, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { ClearFilters, FilterSheet, PageToolbar } from "@/components/admin/page-toolbar";
import { OrderLinks } from "@/components/admin/sections";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABEL, CHANNELS, STATUS_LABEL, type OrderStatus } from "@/domain/types";
import { formatMaybe } from "@/lib/brand";
import { getDeliveries, getMe } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/giao-hang")({
  component: DeliveryPage,
});

function DeliveryPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const rows = useQuery({ queryKey: ["deliveries"], queryFn: () => getDeliveries() });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [sheet, setSheet] = useState(false);
  const money = me.data?.role !== "production";
  const list = rows.data ?? [];
  const statusChips = useMemo<FilterChip[]>(() => {
    const ids = [...new Set(list.map((order) => order.status))];
    return [
      { id: "all", label: "Tất cả", count: list.length, ...ALL_TONE },
      ...ids.map((id) => ({
        id,
        label: STATUS_LABEL[id as OrderStatus] ?? id,
        count: list.filter((order) => order.status === id).length,
        color: STATUS_TONE[id]?.color ?? "#6B7280",
        icon: STATUS_TONE[id]?.icon,
      })),
    ];
  }, [list]);
  const channelChips = useMemo<FilterChip[]>(() => {
    return [
      { id: "all", label: "Mọi kênh", count: list.length, ...ALL_TONE },
      ...CHANNELS.map((id) => {
        const tone = CHANNEL_TONE[id] ?? ALL_TONE;
        return {
          id,
          label: CHANNEL_LABEL[id],
          count: list.filter((order) => order.channel === id).length,
          color: tone.color,
          icon: tone.icon,
        };
      }),
    ];
  }, [list]);
  const shown = list.filter((order) => {
    if (status !== "all" && order.status !== status) return false;
    if (channel !== "all" && order.channel !== channel) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return [order.code, order.customerName, order.recipientName, order.phone, order.tracking, order.address]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const filterCount = (status !== "all" ? 1 : 0) + (channel !== "all" ? 1 : 0);
  const page = useListPage(shown, `${status}|${channel}|${q}`);
  if (rows.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (rows.isError) return <p className="font-semibold text-destructive">{(rows.error as Error).message}</p>;
  return (
    <div className="space-y-3">
      <OrderLinks />
      <PageToolbar
        title="Giao hàng"
        hint="Đơn giao tận nơi và đơn Facebook, TikTok, Shopee. Tem 100×150 chỉ in cho đơn tại tiệm và Facebook."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã, tên, SĐT, vận đơn…"
        filterCount={filterCount}
        onFilter={() => setSheet(true)}
        below={
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <FilterChips label="Kênh giao" value={channel} chips={channelChips} onChange={setChannel} />
            {filterCount > 0 ? (
              <ClearFilters
                onClick={() => {
                  setStatus("all");
                  setChannel("all");
                }}
              />
            ) : null}
          </div>
        }
      />
      <FilterChips label="Trạng thái giao" value={status} chips={statusChips} onChange={setStatus} />
      <ListPager page={page.page} pages={page.pages} total={page.total} start={page.start} count={page.slice.length} noun="đơn giao" onPage={page.setPage} />
      <div className="grid gap-3">
        {page.slice.map((order) => (
          <article key={order.id} className="space-y-1 rounded-2xl border border-border/70 bg-card p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="text-lg font-extrabold text-primary">
                {order.code}
              </Link>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{order.statusLabel}</span>
            </div>
            <p>{order.recipientName || order.customerName} · {order.phone}</p>
            {order.recipientName && order.recipientName !== order.customerName ? <p>Khách trong sổ: {order.customerName}</p> : null}
            {order.address ? <p>{order.address}</p> : null}
            <p className="text-muted-foreground">{order.channelLabel} · {order.itemSummary}</p>
            <p>Hãng: {order.carrier || "chưa ghi"} · Vận đơn: {order.tracking || "chưa có"}</p>
            {money ? (
              <p>Phí ship: {order.shipFee === null ? "chưa có" : formatMaybe(order.shipFee)} · COD: {order.codAmount === null ? "không" : formatMaybe(order.codAmount)}</p>
            ) : null}
            {order.canLabel && money ? (
              <Button asChild variant="outline" className="mt-2 min-h-11">
                <Link to="/admin/tem/$code" params={{ code: order.code }}>In tem 100×150</Link>
              </Button>
            ) : null}
          </article>
        ))}
        {rows.data && shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{list.length === 0 ? "Chưa có đơn cần giao." : "Không có đơn khớp bộ lọc."}</p>
        ) : null}
      </div>
      <FilterSheet open={sheet} onClose={() => setSheet(false)} title="Bộ lọc giao hàng">
        <FilterChips label="Kênh giao" value={channel} chips={channelChips} onChange={setChannel} wrap />
        {filterCount > 0 ? (
          <ClearFilters
            onClick={() => {
              setStatus("all");
              setChannel("all");
            }}
          />
        ) : null}
      </FilterSheet>
    </div>
  );
}
