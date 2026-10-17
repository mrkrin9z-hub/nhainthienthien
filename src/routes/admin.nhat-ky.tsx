import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

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
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role !== "owner") return <p className="text-lg font-semibold text-primary">Chỉ chủ xem.</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Nhật ký</h1>
      <p className="text-sm text-muted-foreground">Đăng nhập, đổi giá, trạng thái đơn, kho và sao lưu. 200 dòng mới nhất.</p>
      {audits.isError ? <p className="font-semibold text-destructive">{(audits.error as Error).message}</p> : null}
      <ul className="space-y-2">
        {(audits.data ?? []).map((item) => (
          <li key={item.id} className="glass-card rounded-2xl px-4 py-3 text-sm">
            <p className="font-semibold text-foreground">
              {new Date(item.at).toLocaleString("vi-VN")} · {item.actorName || "Hệ thống"} · {item.action}
            </p>
            <p className="text-muted-foreground">{item.entity}</p>
          </li>
        ))}
        {audits.data && audits.data.length === 0 ? <li>Chưa có dòng nào.</li> : null}
      </ul>
    </div>
  );
}
