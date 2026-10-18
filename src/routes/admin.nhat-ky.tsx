import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { UserRound } from "lucide-react";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ClearFilters, FilterSheet, PageToolbar } from "@/components/admin/page-toolbar";
import { AUDIT_ACTIONS } from "@/domain/audit-text";
import { getAudits, getMe } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/nhat-ky")({
  component: AuditPage,
});

function AuditPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const audits = useQuery({
    queryKey: ["audits"],
    queryFn: () => getAudits(),
    enabled: me.data?.role === "owner",
  });
  const [actorId, setActorId] = useState("all");
  const [action, setAction] = useState("all");
  const [day, setDay] = useState("");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const rows = audits.data ?? [];
  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) {
      const key = row.actorId ?? "system";
      if (!seen.has(key)) seen.set(key, row.actorName);
    }
    return [...seen.entries()];
  }, [rows]);
  const actions = useMemo(() => {
    const known = new Map(AUDIT_ACTIONS.map((item) => [item.action, item.label]));
    for (const row of rows) if (!known.has(row.action)) known.set(row.action, row.actionLabel);
    return [...known.entries()];
  }, [rows]);
  const personChips = useMemo<FilterChip[]>(() => {
    return [
      { id: "all", label: "Mọi người", count: rows.length, ...ALL_TONE },
      ...people.map(([id, name]) => ({
        id,
        label: name,
        count: rows.filter((row) => (row.actorId ?? "system") === id).length,
        color: "#1D4ED8",
        icon: UserRound,
      })),
    ];
  }, [people, rows]);
  const actionChips = useMemo<FilterChip[]>(() => {
    const used = actions.filter(([id]) => rows.some((row) => row.action === id));
    return [
      { id: "all", label: "Mọi việc", count: rows.length, ...ALL_TONE },
      ...used.map(([id, label]) => ({
        id,
        label,
        count: rows.filter((row) => row.action === id).length,
        color: "#0F766E",
      })),
    ];
  }, [actions, rows]);
  const shown = rows.filter((row) => {
    if (actorId !== "all" && (row.actorId ?? "system") !== actorId) return false;
    if (action !== "all" && row.action !== action) return false;
    if (day && row.day !== day) return false;
    const needle = q.trim().toLowerCase();
    if (needle && !`${row.sentence} ${row.actorName}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const filterCount = (actorId !== "all" ? 1 : 0) + (action !== "all" ? 1 : 0) + (day ? 1 : 0);

  function clearFilters() {
    setActorId("all");
    setAction("all");
    setDay("");
  }

  function dayField() {
    return (
      <label className="block text-sm font-semibold">
        Ngày (giờ Việt Nam)
        <input
          type="date"
          className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3"
          value={day}
          aria-label="Lọc theo ngày"
          onChange={(event) => setDay(event.target.value)}
        />
      </label>
    );
  }

  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role !== "owner") return <p className="text-lg font-semibold text-primary">Chỉ chủ xem.</p>;
  return (
    <div className="space-y-3">
      <PageToolbar
        title="Nhật ký"
        hint="200 dòng mới nhất. Lọc theo người, việc hoặc ngày."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm trong dòng nhật ký…"
        filterCount={filterCount}
        onFilter={() => setSheet(true)}
        below={
          <div className="hidden space-y-2 sm:block">
            <FilterChips label="Người" value={actorId} chips={personChips} onChange={setActorId} />
            <FilterChips label="Việc" value={action} chips={actionChips} onChange={setAction} />
            <div className="flex flex-wrap items-end gap-2">
              {dayField()}
              {filterCount > 0 ? <ClearFilters onClick={clearFilters} /> : null}
            </div>
          </div>
        }
      />
      {audits.isError ? <p className="font-semibold text-destructive">{(audits.error as Error).message}</p> : null}
      <p className="text-xs text-muted-foreground">Hiển thị {shown.length} dòng</p>
      <ul className="space-y-2">
        {shown.map((item) => (
          <li key={item.id} className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm">
            <p className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
            <p className="mt-1 break-words font-semibold text-foreground">{item.sentence}</p>
          </li>
        ))}
        {audits.data && shown.length === 0 ? <li className="text-sm text-muted-foreground">{rows.length === 0 ? "Chưa có dòng nào." : "Không có dòng khớp bộ lọc."}</li> : null}
      </ul>
      <FilterSheet open={sheet} onClose={() => setSheet(false)} title="Bộ lọc nhật ký">
        <FilterChips label="Người" value={actorId} chips={personChips} onChange={setActorId} wrap />
        <FilterChips label="Việc" value={action} chips={actionChips} onChange={setAction} wrap />
        {dayField()}
        {filterCount > 0 ? <ClearFilters onClick={clearFilters} /> : null}
      </FilterSheet>
    </div>
  );
}
