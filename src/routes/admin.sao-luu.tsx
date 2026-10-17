import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { createBackupNow, fetchBackup, getBackups, getMe, previewRestore, restoreBackup } from "@/lib/admin.functions";

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
  const [preview, setPreview] = useState<{ key: string; keep: string[]; replace: string[] } | null>(null);
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role !== "owner") return <p className="text-lg font-semibold text-primary">Chỉ chủ xem.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-primary">Sao lưu sổ</h1>
        <Button
          className="min-h-11"
          onClick={async () => {
            const result = await createBackupNow();
            toast.success("Đã sao lưu ngay");
            await queryClient.invalidateQueries({ queryKey: ["backups"] });
            void result;
          }}
        >
          Sao lưu ngay
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Mỗi ngày một khóa shop_backup:năm-tháng-ngày theo giờ Việt Nam, ghi đè an toàn. Giữ 30 ngày. Nút Sao lưu ngay ghi shop_backup:manual và giữ 10 bản.
      </p>
      {backups.isError ? <p className="font-semibold text-destructive">{(backups.error as Error).message}</p> : null}
      {preview ? (
        <section className="glass-card space-y-3 rounded-3xl p-4">
          <h2 className="font-bold text-primary">Khôi phục {preview.key}</h2>
          <p className="text-sm font-semibold">Giữ nguyên</p>
          <ul className="list-disc pl-5 text-sm">
            {preview.keep.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="text-sm font-semibold">Sẽ thay bằng bản sao</p>
          <ul className="list-disc pl-5 text-sm">
            {preview.replace.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              onClick={async () => {
                await restoreBackup({ data: { key: preview.key } });
                setPreview(null);
                toast.success("Đã khôi phục. Tài khoản đang dùng được giữ.");
                await queryClient.invalidateQueries();
              }}
            >
              Khôi phục
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setPreview(null)}>Hủy</Button>
          </div>
        </section>
      ) : null}
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
                  const next = await previewRestore({ data: { key: item.key } });
                  setPreview(next);
                }}
              >
                Khôi phục
              </Button>
            </span>
          </li>
        ))}
        {backups.data && backups.data.length === 0 ? <li>Chưa có bản sao lưu.</li> : null}
      </ul>
    </div>
  );
}
