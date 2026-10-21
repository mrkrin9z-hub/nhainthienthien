import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { getOrderFeedback } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/danh-gia")({
  component: FeedbackPage,
});

type Row = {
  code: string;
  status: string;
  statusLabel: string;
  customerName: string;
  at: string;
  answer: string;
  answerLabel: string;
  note: string;
  opensReprint: boolean;
};

function FeedbackPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <FeedbackBody />
    </RoleGate>
  );
}

function FeedbackBody() {
  const [q, setQ] = useState("");
  const data = useQuery({ queryKey: ["order-feedback"], queryFn: () => getOrderFeedback() });
  const rows = useMemo(() => {
    const list = (data.data?.feedback ?? []) as Row[];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((row) => `${row.code} ${row.customerName} ${row.answerLabel} ${row.note}`.toLowerCase().includes(needle));
  }, [data.data, q]);
  const list = useListPage(rows, q);

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Đánh giá đơn hàng"
        hint="Phản hồi khách sau giao (link /danh-gia/…). Sai màu / sai khổ mở phiếu in lại."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã đơn, khách…"
      />
      {data.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {data.isError ? <p className="font-semibold text-destructive">{(data.error as Error).message}</p> : null}
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="đánh giá" onPage={list.setPage} />
      <ul className="space-y-2">
        {list.slice.map((row) => (
          <li key={`${row.code}-${row.at}`} className="rounded-md border bg-card px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/admin/don-hang/$code" params={{ code: row.code }} className="font-semibold text-primary">
                {row.code}
              </Link>
              <Badge variant={row.opensReprint ? "destructive" : "secondary"}>{row.answerLabel}</Badge>
              <span className="text-xs text-muted-foreground">{row.statusLabel}</span>
            </div>
            <p className="mt-1 text-sm">{row.customerName}</p>
            {row.note ? <p className="mt-1 text-sm text-muted-foreground">{row.note}</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">{new Date(row.at).toLocaleString("vi-VN")}</p>
          </li>
        ))}
      </ul>
      {!data.isLoading && rows.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Chưa có đánh giá nào.</p>
      ) : null}
    </div>
  );
}
