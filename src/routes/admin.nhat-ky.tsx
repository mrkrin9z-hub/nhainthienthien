import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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
  const shown = rows.filter((row) => {
    if (actorId !== "all" && (row.actorId ?? "system") !== actorId) return false;
    if (action !== "all" && row.action !== action) return false;
    if (day && row.day !== day) return false;
    return true;
  });

  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role !== "owner") return <p className="text-lg font-semibold text-primary">Chỉ chủ xem.</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Nhật ký</h1>
      <p className="text-sm text-muted-foreground">200 dòng mới nhất. Lọc theo người, việc hoặc ngày (giờ Việt Nam).</p>
      <div className="grid gap-2">
        <select className="min-h-12 w-full rounded-xl border bg-background px-3" value={actorId} onChange={(event) => setActorId(event.target.value)} aria-label="Lọc theo người">
          <option value="all">Mọi người</option>
          {people.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select className="min-h-12 w-full rounded-xl border bg-background px-3" value={action} onChange={(event) => setAction(event.target.value)} aria-label="Lọc theo việc">
          <option value="all">Mọi việc</option>
          {actions.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="min-h-12 w-full rounded-xl border bg-background px-3"
          value={day}
          aria-label="Lọc theo ngày"
          onChange={(event) => setDay(event.target.value)}
        />
        {actorId !== "all" || action !== "all" || day ? (
          <button type="button" className="min-h-11 text-left text-sm font-semibold text-primary" onClick={() => { setActorId("all"); setAction("all"); setDay(""); }}>
            Bỏ lọc
          </button>
        ) : null}
      </div>
      {audits.isError ? <p className="font-semibold text-destructive">{(audits.error as Error).message}</p> : null}
      <ul className="space-y-2">
        {shown.map((item) => (
          <li key={item.id} className="glass-card rounded-2xl px-4 py-3 text-sm">
            <p className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p>
            <p className="mt-1 break-words font-semibold text-foreground">{item.sentence}</p>
          </li>
        ))}
        {audits.data && shown.length === 0 ? <li className="text-sm text-muted-foreground">{rows.length === 0 ? "Chưa có dòng nào." : "Không có dòng khớp bộ lọc."}</li> : null}
      </ul>
    </div>
  );
}
