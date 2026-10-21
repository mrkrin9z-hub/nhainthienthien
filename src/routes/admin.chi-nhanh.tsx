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
import { deleteBranch, getOrg, storeBranch } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/chi-nhanh")({
  component: BranchPage,
});

type BranchRow = {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
  sort: number;
};

const empty = { id: "", name: "", address: "", phone: "", active: true };

function BranchPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <BranchBody />
    </RoleGate>
  );
}

function BranchBody() {
  const queryClient = useQueryClient();
  const org = useQuery({ queryKey: ["org"], queryFn: () => getOrg() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const rows = (org.data?.branches ?? []) as BranchRow[];

  function openNew() {
    setForm(empty);
    setOpen(true);
  }

  function openEdit(row: BranchRow) {
    setForm({ id: row.id, name: row.name, address: row.address, phone: row.phone, active: row.active });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Cửa hàng / chi nhánh"
        hint="Cơ sở in — gán nhân viên ở Nhân viên. Filter đơn/ví theo chi nhánh sẽ dùng danh sách này."
        actions={<ToolbarButton label="Thêm" icon={Plus} primary onClick={openNew} />}
      />
      {org.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {org.isError ? <p className="font-semibold text-destructive">{(org.error as Error).message}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-4 py-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEdit(row)}>
              <p className="font-semibold">{row.name}</p>
              <p className="text-xs text-muted-foreground">
                {[row.address, row.phone].filter(Boolean).join(" · ") || "Chưa có địa chỉ / SĐT"}
              </p>
            </button>
            <Badge variant={row.active ? "default" : "secondary"}>{row.active ? "Đang mở" : "Tạm đóng"}</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={rows.length <= 1}
              onClick={async () => {
                if (!confirm(`Xóa cửa hàng “${row.name}”?`)) return;
                try {
                  await deleteBranch({ data: { id: row.id } });
                  toast.success("Đã xóa cửa hàng");
                  await queryClient.invalidateQueries({ queryKey: ["org"] });
                  await queryClient.invalidateQueries({ queryKey: ["settings"] });
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Sửa cửa hàng" : "Thêm cửa hàng"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await storeBranch({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    name: form.name,
                    address: form.address,
                    phone: form.phone,
                    active: form.active,
                  },
                });
                toast.success("Đã lưu cửa hàng");
                setOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["org"] });
                await queryClient.invalidateQueries({ queryKey: ["settings"] });
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
              <Label>Địa chỉ</Label>
              <Input className="mt-1 min-h-11" value={form.address} onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))} />
            </div>
            <div>
              <Label>Số điện thoại</Label>
              <Input className="mt-1 min-h-11" inputMode="tel" value={form.phone} onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />
              Đang mở
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
