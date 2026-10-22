import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  { key: "lateOrders", label: "Đơn trễ hẹn giao", hint: "Cảnh báo trên Trang chủ / Lịch (PC + PWA)." },
  { key: "marketplaceNew", label: "Đơn sàn mới", hint: "Chỉ hiện khi TikTok hoặc Shopee đã nối. Chưa nối thì bỏ qua." },
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
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (data.data?.notifyPrefs) setPrefs(data.data.notifyPrefs);
  }, [data.data]);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    const mq = window.matchMedia("(display-mode: standalone)");
    setStandalone(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  }, []);

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Thông báo đẩy"
        hint="Bấm Bật báo. Nếu trình duyệt từ chối, mở lại phần cài đặt trang (biểu tượng khóa cạnh địa chỉ) và cho phép thông báo."
      />
      <p className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">
        Trạng thái quyền trình duyệt: <strong className="text-foreground">{perm === "denied" ? "bị chặn — mở cài đặt trang để cho phép lại" : perm === "granted" ? "đã cho phép" : "chưa hỏi"}</strong>
        {standalone ? " · đang chạy PWA (standalone)" : " · mở trong tab trình duyệt (có thể Add to Home Screen)"}
      </p>
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
                await navigator.serviceWorker?.ready;
                const next = await Notification.requestPermission();
                setPerm(next);
                setPrefs((c) => (c ? { ...c, browserPrompted: true } : c));
                if (next === "granted") {
                  toast.success("Đã cho phép thông báo");
                  try {
                    const reg = await navigator.serviceWorker.ready;
                    await reg.showNotification("Nhà In Thiên Thiên", {
                      body: "Thông báo PWA/PC đã bật. Cảnh báo đơn sẽ hiện khi có việc trên Trang chủ.",
                      icon: "/brand/icon-192.png",
                      data: { url: "/admin" },
                    });
                  } catch {
                    new Notification("Nhà In Thiên Thiên", { body: "Thông báo đã bật." });
                  }
                } else toast.message(`Quyền thông báo: ${next}`);
              }}
            >
              Cấp quyền PC / PWA ({perm})
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
