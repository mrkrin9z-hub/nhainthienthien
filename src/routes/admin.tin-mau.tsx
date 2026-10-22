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
import { MESSAGE_KIND_LABEL } from "@/domain/org-desk";
import type { MessageTemplateKind } from "@/domain/types";
import { deleteMessageTemplate, getMessageTemplates, storeMessageTemplate } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tin-mau")({
  component: TemplatesPage,
});

type Row = { id: string; title: string; body: string; kind: MessageTemplateKind; updatedAt: string };

const empty = { id: "", title: "", body: "", kind: "chat" as MessageTemplateKind };

function TemplatesPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <TemplatesBody />
    </RoleGate>
  );
}

function TemplatesBody() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["templates"], queryFn: () => getMessageTemplates() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const rows = (data.data?.templates ?? []) as Row[];
  return (
    <div className="space-y-4">
      <PageToolbar
        title="Tin mẫu"
        hint="Soạn tin mẫu gửi khách trong app."
        actions={
          <ToolbarButton
            label="Thêm tin"
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
                  setForm({ id: row.id, title: row.title, body: row.body, kind: row.kind });
                  setOpen(true);
                }}
              >
                <p className="font-semibold">
                  {row.title}{" "}
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {MESSAGE_KIND_LABEL[row.kind] ?? row.kind}
                  </Badge>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{row.body}</p>
              </button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(row.body);
                    toast.success("Đã chép tin mẫu");
                  }}
                >
                  Chép
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!confirm("Xóa tin mẫu này?")) return;
                    try {
                      await deleteMessageTemplate({ data: { id: row.id } });
                      toast.success("Đã xóa");
                      await queryClient.invalidateQueries({ queryKey: ["templates"] });
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Xóa
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Sửa tin mẫu" : "Thêm tin mẫu"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await storeMessageTemplate({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    title: form.title,
                    body: form.body,
                    kind: form.kind,
                  },
                });
                toast.success("Đã lưu tin mẫu");
                setOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["templates"] });
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
              <Label>Loại</Label>
              <select
                className="mt-1 min-h-11 w-full rounded-md border bg-background px-2"
                value={form.kind}
                onChange={(e) => setForm((c) => ({ ...c, kind: e.target.value as MessageTemplateKind }))}
              >
                {Object.entries(MESSAGE_KIND_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Nội dung</Label>
              <Textarea className="mt-1" rows={5} value={form.body} onChange={(e) => setForm((c) => ({ ...c, body: e.target.value }))} required />
              <p className="mt-1 text-xs text-muted-foreground">Có thể dùng {"{ten}"}, {"{ngay}"}, {"{so_don}"} khi chép từ Nhắc khách.</p>
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
