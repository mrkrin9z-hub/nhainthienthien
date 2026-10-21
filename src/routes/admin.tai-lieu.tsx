import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteDocument, getDocuments, storeDocument } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tai-lieu")({
  component: DocumentsPage,
});

type Row = { id: string; title: string; body: string; url: string; at: string };

const empty = { id: "", title: "", body: "", url: "" };

function DocumentsPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <DocumentsBody />
    </RoleGate>
  );
}

function DocumentsBody() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["documents"], queryFn: () => getDocuments() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const rows = (data.data?.documents ?? []) as Row[];

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Tài liệu"
        hint="Kho link / ghi chú nội bộ (SOP, bảng giá PDF, Drive…)."
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
                  setForm({ id: row.id, title: row.title, body: row.body, url: row.url });
                  setOpen(true);
                }}
              >
                <p className="font-semibold">{row.title}</p>
                {row.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p> : null}
                {row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-medium text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Mở link
                  </a>
                ) : null}
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!confirm("Xóa tài liệu này?")) return;
                  try {
                    await deleteDocument({ data: { id: row.id } });
                    toast.success("Đã xóa");
                    await queryClient.invalidateQueries({ queryKey: ["documents"] });
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
        <p className="rounded-2xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Chưa có tài liệu.</p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Sửa tài liệu" : "Thêm tài liệu"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await storeDocument({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    title: form.title,
                    body: form.body,
                    url: form.url,
                  },
                });
                toast.success("Đã lưu tài liệu");
                setOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["documents"] });
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
              <Label>Link (tuỳ chọn)</Label>
              <Input className="mt-1 min-h-11" value={form.url} onChange={(e) => setForm((c) => ({ ...c, url: e.target.value }))} placeholder="https://…" />
            </div>
            <div>
              <Label>Ghi chú</Label>
              <Textarea className="mt-1" rows={4} value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} />
            </div>
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
