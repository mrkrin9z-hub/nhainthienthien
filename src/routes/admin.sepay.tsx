import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSePayConfig, storeSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/sepay")({
  component: SePayPage,
});

function SePayPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <SePayBody />
    </RoleGate>
  );
}

function SePayBody() {
  const queryClient = useQueryClient();
  const cfg = useQuery({ queryKey: ["sepay"], queryFn: () => getSePayConfig() });
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [accountHint, setAccountHint] = useState("");
  const [webhookPath, setWebhookPath] = useState("/api/public/sepay");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (!cfg.data?.sepay) return;
    setEnabled(cfg.data.sepay.enabled);
    setApiKey(cfg.data.sepay.apiKey ?? "");
    setAccountHint(cfg.data.sepay.accountHint);
    setWebhookPath(cfg.data.sepay.webhookPath || "/api/public/sepay");
    setNote(cfg.data.sepay.note);
  }, [cfg.data]);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const bank = cfg.data?.bank;
  const webhookUrl = `${origin}${webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`}`;

  return (
    <div className="space-y-4">
      <PageToolbar
        title="SePay"
        hint="Webhook tiền vào → khớp mã CK (mã đơn VietQR, ví dụ TT251021-001) → tự ghi thu chuyển khoản như StudioBase."
      />
      {cfg.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      <div className="space-y-2 rounded-md border bg-card px-4 py-3 text-sm">
        <p>
          Tài khoản ngân hàng trên Cài đặt:{" "}
          {bank ? (
            <span className="font-medium">
              {bank.holder} · {bank.account}
            </span>
          ) : (
            <span className="text-destructive">chưa cấu hình</span>
          )}
        </p>
        <p>
          URL webhook dán vào SePay:{" "}
          <code className="rounded bg-muted px-1 text-xs break-all">{webhookUrl || webhookPath}</code>
        </p>
        <p className="text-muted-foreground">
          Trên my.sepay.vn: cấu trúc mã thanh toán tiền tố <code className="rounded bg-muted px-1">TT</code>, sự kiện{" "}
          <strong>Money in</strong>, Auth = API Key (dán vào ô bên dưới). Chỉ gửi khi có mã thanh toán.
        </p>
      </div>
      <form
        className="space-y-3 rounded-md border bg-card p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await storeSettings({
              data: {
                sepay: { enabled, apiKey, accountHint, webhookPath, note },
              },
            });
            toast.success("Đã lưu SePay");
            await queryClient.invalidateQueries({ queryKey: ["sepay"] });
            await queryClient.invalidateQueries({ queryKey: ["settings"] });
          } catch (error) {
            toast.error((error as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Bật tự thu qua SePay
        </label>
        <div>
          <Label htmlFor="sepay-key">API Key xác thực webhook</Label>
          <Input
            id="sepay-key"
            className="mt-1 min-h-11 font-mono text-sm"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Trùng key cấu hình trên SePay (Authorization / X-Api-Key)"
          />
        </div>
        <div>
          <Label htmlFor="sepay-hint">Gợi ý tài khoản SePay</Label>
          <Input id="sepay-hint" className="mt-1 min-h-11" value={accountHint} onChange={(e) => setAccountHint(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sepay-hook">Đường webhook</Label>
          <Input id="sepay-hook" className="mt-1 min-h-11 font-mono text-sm" value={webhookPath} onChange={(e) => setWebhookPath(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="sepay-note">Ghi chú</Label>
          <Textarea id="sepay-note" className="mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu"}
        </Button>
      </form>
    </div>
  );
}
