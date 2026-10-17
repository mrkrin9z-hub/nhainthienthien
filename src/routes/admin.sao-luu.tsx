import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchBackup, getBackups, getMe, restoreBackup } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/sao-luu")({
  component: BackupPage,
});

function BackupPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const queryClient = useQueryClient();
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: () => getBackups(),
    enabled: me.data?.role === "owner",
  });
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role !== "owner") return <p className="text-lg font-semibold text-primary">Chỉ chủ xem.</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Sao lưu sổ</h1>
      <p className="text-sm text-muted-foreground">
        Mỗi ngày một bản trong KV (hoặc thư mục data/backups khi chạy local), giữ 30 bản mới nhất. Khóa có dấu thời gian.
      </p>
      {backups.isError ? <p className="font-semibold text-destructive">{(backups.error as Error).message}</p> : null}
      <ul className="space-y-2">
        {(backups.data ?? []).map((item) => (
          <li key={item.key} className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm">
            <span>
              <span className="font-semibold">{item.key}</span>
              <span className="mt-1 block text-muted-foreground">{new Date(item.at).toLocaleString("vi-VN")}</span>
            </span>
            <span className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={async () => {
                  const file = await fetchBackup({ data: { key: item.key } });
                  const blob = new Blob([file.json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = file.filename;
                  a.click();
                }}
              >
                Tải về
              </Button>
              <Button
                className="min-h-11"
                onClick={async () => {
                  if (!window.confirm("Khôi phục bản này sẽ thay sổ đang dùng. Tiếp tục?")) return;
                  await restoreBackup({ data: { key: item.key } });
                  toast.success("Đã khôi phục sổ");
                  await queryClient.invalidateQueries();
                }}
              >
                Khôi phục
              </Button>
            </span>
          </li>
        ))}
        {backups.data && backups.data.length === 0 ? <li>Chưa có bản sao lưu. Mở lại trang sau khi sổ được đọc.</li> : null}
      </ul>
    </div>
  );
}
