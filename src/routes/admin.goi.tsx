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
import { Textarea } from "@/components/ui/textarea";
import { formatMaybe } from "@/lib/brand";
import { deletePackage, getMe, getPackages, storePackage } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/goi")({
  component: PackagesPage,
});

type Row = {
  id: string;
  name: string;
  price: number;
  description: string;
  includes: string;
  active: boolean;
};

const empty = { id: "", name: "", price: "", description: "", includes: "", active: true };

function PackagesPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem gói bán.">
      <PackagesBody />
    </RoleGate>
  );
}

function PackagesBody() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const data = useQuery({ queryKey: ["packages"], queryFn: () => getPackages() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const rows = (data.data?.packages ?? []) as Row[];
  const canEdit = me.data?.role === "owner";

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Gói dịch vụ"
        hint="Gói bán tại xưởng (combo in, album, ảnh thờ…). Không phải gói subscription StudioBase."
        actions={
          canEdit ? (
            <ToolbarButton
              label="Thêm gói"
              icon={Plus}
              primary
              onClick={() => {
                setForm(empty);
                setOpen(true);
              }}
            />
          ) : null
        }
      />
      {data.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-md border bg-card px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                disabled={!canEdit}
                onClick={() => {
                  if (!canEdit) return;
                  setForm({
                    id: row.id,
                    name: row.name,
                    price: String(row.price),
                    description: row.description,
                    includes: row.includes,
                    active: row.active,
                  });
                  setOpen(true);
                }}
              >
                <p className="font-semibold">
                  {row.name}{" "}
                  <span className="text-primary">{formatMaybe(row.price)}</span>
                </p>
                {row.description ? <p className="mt-1 text-sm text-muted-foreground">{row.description}</p> : null}
                {row.includes ? <p className="mt-1 whitespace-pre-wrap text-sm">{row.includes}</p> : null}
              </button>
              <Badge variant={row.active ? "default" : "secondary"}>{row.active ? "Đang bán" : "Ẩn"}</Badge>
              {canEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!confirm(`Xóa gói “${row.name}”?`)) return;
                    try {
                      await deletePackage({ data: { id: row.id } });
                      toast.success("Đã xóa gói");
                      await queryClient.invalidateQueries({ queryKey: ["packages"] });
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Xóa
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!data.isLoading && rows.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Chưa có gói dịch vụ.</p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Sửa gói" : "Thêm gói"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await storePackage({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    name: form.name,
                    price: Number(form.price.replace(/\D/g, "") || "0"),
                    description: form.description,
                    includes: form.includes,
                    active: form.active,
                  },
                });
                toast.success("Đã lưu gói");
                setOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["packages"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div>
              <Label>Tên gói</Label>
              <Input className="mt-1 min-h-11" value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} required minLength={2} />
            </div>
            <div>
              <Label>Giá (đ)</Label>
              <Input className="mt-1 min-h-11" inputMode="numeric" value={form.price} onChange={(e) => setForm((c) => ({ ...c, price: e.target.value.replace(/[^\d]/g, "") }))} required />
            </div>
            <div>
              <Label>Mô tả ngắn</Label>
              <Input className="mt-1 min-h-11" value={form.description} onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))} />
            </div>
            <div>
              <Label>Bao gồm</Label>
              <Textarea className="mt-1" rows={4} value={form.includes} onChange={(e) => setForm((c) => ({ ...c, includes: e.target.value }))} placeholder={"- Ảnh thờ 40×60\n- Ép gỗ\n- …"} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((c) => ({ ...c, active: e.target.checked }))} />
              Đang bán
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
