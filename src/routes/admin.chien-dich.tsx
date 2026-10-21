import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteCampaign, getCampaigns, storeCampaign } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/chien-dich")({
  component: CampaignPage,
});

type Row = {
  id: string;
  name: string;
  note: string;
  active: boolean;
  sort: number;
  orderCount: number;
  customerCount: number;
};

const empty = { id: "", name: "", note: "", active: true };

function CampaignPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <CampaignBody />
    </RoleGate>
  );
}

function CampaignBody() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["campaigns"], queryFn: () => getCampaigns() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const rows = (data.data?.campaigns ?? []) as Row[];

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Chiến dịch"
        hint="Nguồn / chiến dịch ads local. Gắn vào đơn hoặc khách qua mã campaignId khi nhập đơn (bước sau). Đếm đơn/khách đã gắn."
        actions={
          <ToolbarButton
            label="Thêm"
            icon={Plus}
            primary
            onClick={() => {
              setForm(empty);
              setOpen(true);
            }}
          />
        }
      />
      {data.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-4 py-3">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                setForm({ id: row.id, name: row.name, note: row.note, active: row.active });
                setOpen(true);
              }}
            >
              <p className="font-semibold">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.note || "—"} · {row.orderCount} đơn · {row.customerCount} khách
              </p>
            </button>
            <Badge variant={row.active ? "default" : "secondary"}>{row.active ? "Đang chạy" : "Tắt"}</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!confirm(`Xóa chiến dịch “${row.name}”?`)) return;
                try {
                  await deleteCampaign({ data: { id: row.id } });
                  toast.success("Đã xóa");
                  await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            >
              Xóa
            </Button>
          </li>
        ))}
      </ul>
      {!data.isLoading && rows.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Chưa có chiến dịch.</p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Sửa chiến dịch" : "Thêm chiến dịch"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await storeCampaign({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    name: form.name,
                    note: form.note,
                    active: form.active,
                  },
                });
                toast.success("Đã lưu chiến dịch");
                setOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div>
              <Label>Tên</Label>
              <Input className="mt-1 min-h-11" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required minLength={2} />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Input className="mt-1 min-h-11" value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} placeholder="FB ads T10, TikTok…" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />
              Đang chạy
            </label>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Đang lưu…" : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
