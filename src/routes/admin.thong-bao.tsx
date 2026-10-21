import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { studioManageUrl } from "@/admin-os/bridges";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { getNotifyPrefs, storeSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/thong-bao")({
  component: NotifyPage,
});

type Prefs = {
  lateOrders: boolean;
  marketplaceNew: boolean;
  feedbackReprint: boolean;
  cashHandover: boolean;
  browserPrompted?: boolean;
};

const LABELS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "lateOrders", label: "Đơn trễ hẹn giao", hint: "Cảnh báo trên Trang chủ / Lịch." },
  { key: "marketplaceNew", label: "Đơn sàn mới", hint: "TikTok / Shopee vừa nhập." },
  { key: "feedbackReprint", label: "Đánh giá mở in lại", hint: "Khách báo sai màu / sai khổ." },
  { key: "cashHandover", label: "Nộp tiền mặt", hint: "Nhắc khi sale giữ tiền mặt." },
];

function NotifyPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <NotifyBody />
    </RoleGate>
  );
}

function NotifyBody() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["notify-prefs"], queryFn: () => getNotifyPrefs() });
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [perm, setPerm] = useState<string>("default");

  useEffect(() => {
    if (data.data?.notifyPrefs) setPrefs(data.data.notifyPrefs);
  }, [data.data]);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);

  const pushHref = studioManageUrl("/manage/settings/notifications");

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Thông báo đẩy"
        hint="Bật loại cảnh báo trong app. Web Push / VAPID (thông báo ngoài tab) cấu hình trên StudioBase."
      />
      {data.isLoading || !prefs ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {prefs ? (
        <form
          className="space-y-3 rounded-md border bg-card p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            try {
              await storeSettings({ data: { notifyPrefs: prefs } });
              toast.success("Đã lưu tuỳ chọn thông báo");
              await queryClient.invalidateQueries({ queryKey: ["notify-prefs"] });
              await queryClient.invalidateQueries({ queryKey: ["settings"] });
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {LABELS.map((item) => (
            <label key={item.key} className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(prefs[item.key])}
                onChange={(e) => setPrefs((c) => (c ? { ...c, [item.key]: e.target.checked } : c))}
              />
              <span>
                <span className="font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
              </span>
            </label>
          ))}
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                if (typeof Notification === "undefined") {
                  toast.error("Trình duyệt không hỗ trợ Notification.");
                  return;
                }
                const next = await Notification.requestPermission();
                setPerm(next);
                setPrefs((c) => (c ? { ...c, browserPrompted: true } : c));
                if (next === "granted") toast.success("Đã cho phép thông báo trình duyệt");
                else toast.message(`Quyền thông báo: ${next}`);
              }}
            >
              Xin quyền trình duyệt ({perm})
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href={pushHref} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Web Push trên StudioBase
              </a>
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
