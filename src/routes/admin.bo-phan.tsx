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
import { deleteDepartment, getOrg, storeDepartment } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/bo-phan")({
  component: DepartmentPage,
});

type DeptRow = { id: string; name: string; note: string; active: boolean; sort: number };

const empty = { id: "", name: "", note: "", active: true };

function DepartmentPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <DepartmentBody />
    </RoleGate>
  );
}

function DepartmentBody() {
  const queryClient = useQueryClient();
  const org = useQuery({ queryKey: ["org"], queryFn: () => getOrg() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const rows = (org.data?.departments ?? []) as DeptRow[];

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Bộ phận"
        hint="Sale / In ấn / Giao nhận… Gán nhân viên ở Nhân viên."
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
      {org.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
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
              <p className="text-xs text-muted-foreground">{row.note || "—"}</p>
            </button>
            <Badge variant={row.active ? "default" : "secondary"}>{row.active ? "Đang dùng" : "Tắt"}</Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!confirm(`Xóa bộ phận “${row.name}”?`)) return;
                try {
                  await deleteDepartment({ data: { id: row.id } });
                  toast.success("Đã xóa bộ phận");
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
            <DialogTitle>{form.id ? "Sửa bộ phận" : "Thêm bộ phận"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await storeDepartment({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    name: form.name,
                    note: form.note,
                    active: form.active,
                  },
                });
                toast.success("Đã lưu bộ phận");
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
              <Label>Ghi chú</Label>
              <Input className="mt-1 min-h-11" value={form.note} onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />
              Đang dùng
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
