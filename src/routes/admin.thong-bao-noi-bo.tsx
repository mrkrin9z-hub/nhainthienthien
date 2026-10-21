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
import { deleteAnnouncement, getAnnouncements, storeAnnouncement } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/thong-bao-noi-bo")({
  component: AnnouncementsPage,
});

type Row = { id: string; title: string; body: string; at: string; pinned?: boolean };

const empty = { id: "", title: "", body: "", pinned: false };

function AnnouncementsPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <AnnouncementsBody />
    </RoleGate>
  );
}

function AnnouncementsBody() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["announcements"], queryFn: () => getAnnouncements() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const rows = (data.data?.announcements ?? []) as Row[];

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Thông báo nội bộ"
        hint="Ghim tin quan trọng cho team. Không phải Web Push."
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
          <li key={row.id} className="rounded-md border bg-card px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setForm({ id: row.id, title: row.title, body: row.body, pinned: Boolean(row.pinned) });
                  setOpen(true);
                }}
              >
                <p className="font-semibold">
                  {row.pinned ? <Badge className="mr-2">Ghim</Badge> : null}
                  {row.title}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(row.at).toLocaleString("vi-VN")}</p>
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!confirm("Xóa thông báo này?")) return;
                  try {
                    await deleteAnnouncement({ data: { id: row.id } });
                    toast.success("Đã xóa");
                    await queryClient.invalidateQueries({ queryKey: ["announcements"] });
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Xóa
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!data.isLoading && rows.length === 0 ? (
        <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Chưa có thông báo.</p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Sửa thông báo" : "Thêm thông báo"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await storeAnnouncement({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    title: form.title,
                    body: form.body,
                    pinned: form.pinned,
                  },
                });
                toast.success("Đã lưu thông báo");
                setOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["announcements"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div>
              <Label>Tiêu đề</Label>
              <Input className="mt-1 min-h-11" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} required minLength={2} />
            </div>
            <div>
              <Label>Nội dung</Label>
              <Textarea className="mt-1" rows={5} value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((c) => ({ ...c, pinned: e.target.checked }))} />
              Ghim đầu danh sách
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
