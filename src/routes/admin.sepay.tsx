import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { studioManageUrl } from "@/admin-os/bridges";
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
  const [accountHint, setAccountHint] = useState("");
  const [webhookPath, setWebhookPath] = useState("/api/webhooks/sepay");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cfg.data?.sepay) return;
    setEnabled(cfg.data.sepay.enabled);
    setAccountHint(cfg.data.sepay.accountHint);
    setWebhookPath(cfg.data.sepay.webhookPath);
    setNote(cfg.data.sepay.note);
  }, [cfg.data]);

  const bank = cfg.data?.bank;
  const manageHref = studioManageUrl("/manage/settings/sepay");

  return (
    <div className="space-y-4">
      <PageToolbar
        title="SePay"
        hint="Cấu hình cục bộ để nhận biến động số dư vào ví cửa hàng. OAuth / kết nối đầy đủ vẫn mở trên StudioBase khi cần."
      />
      {cfg.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      <p className="rounded-md border bg-card px-4 py-3 text-sm text-muted-foreground">
        Tài khoản ngân hàng trên Cài đặt:{" "}
        {bank ? (
          <span className="font-medium text-foreground">
            {bank.holder} · {bank.account}
          </span>
        ) : (
          <span className="text-destructive">chưa cấu hình — vào Cài đặt để thêm</span>
        )}
      </p>
      <form
        className="space-y-3 rounded-md border bg-card p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          try {
            await storeSettings({
              data: {
                sepay: { enabled, accountHint, webhookPath, note },
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
          Bật ghi nhận SePay (chuẩn bị webhook)
        </label>
        <div>
          <Label htmlFor="sepay-hint">Gợi ý tài khoản SePay</Label>
          <Input id="sepay-hint" className="mt-1 min-h-11" value={accountHint} onChange={(e) => setAccountHint(e.target.value)} placeholder="Số TK / alias trên SePay" />
        </div>
        <div>
          <Label htmlFor="sepay-hook">Đường webhook</Label>
          <Input id="sepay-hook" className="mt-1 min-h-11 font-mono text-sm" value={webhookPath} onChange={(e) => setWebhookPath(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Dán URL đầy đủ (origin + path) vào dashboard SePay khi bật webhook.</p>
        </div>
        <div>
          <Label htmlFor="sepay-note">Ghi chú</Label>
          <Textarea id="sepay-note" className="mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={manageHref} target="_blank" rel="noreferrer">
              Mở SePay trên StudioBase
            </a>
          </Button>
        </div>
      </form>
    </div>
  );
}
