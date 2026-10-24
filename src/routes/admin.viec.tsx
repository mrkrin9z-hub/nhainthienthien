import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { TaskDesk } from "@/components/admin/task-desk";
import { staffThumb } from "@/components/photo-thumb";
import { LIST_LABEL, TASK_DOCS, type TaskCard } from "@/domain/checklists";
import { getMe, loadChecklist, saveChecklistStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/viec")({
  component: ChecklistPage,
});

function ChecklistPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const data = useQuery({ queryKey: ["checklist"], queryFn: () => loadChecklist() });
  const client = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const cards = data.data?.cards ?? [];

  async function setStatus(task: TaskCard, status: TaskCard["status"]) {
    setBusyId(task.id);
    setError("");
    try {
      await saveChecklistStatus({ data: { taskId: task.id, status } });
      await client.invalidateQueries({ queryKey: ["checklist"] });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function upload(task: TaskCard, file: File) {
    setBusyId(task.id);
    setError("");
    const body = new FormData();
    body.set("taskId", task.id);
    body.set("file", file);
    try {
      const response = await fetch("/api/staff/task-photo", { method: "POST", body });
      if (!response.ok) throw new Error(await response.text());
      await client.invalidateQueries({ queryKey: ["checklist"] });
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const open = cards.filter((card) => card.status !== "xong").length;
  const role = me.data?.role === "sale" || me.data?.role === "production" ? me.data.role : "owner";

  return (
    <div className="space-y-4 bg-slate-50">
      <PageToolbar title="Việc cần làm" hint={data.data ? `${open} việc chưa xong. Bấm Xong trên thẻ.` : "Đang tải…"} />
      <div className="flex flex-wrap gap-3 text-sm">
        {TASK_DOCS.map((doc) => (
          <a key={doc.href} href={doc.href} target="_blank" rel="noreferrer" className="font-semibold text-blue-600 underline">
            {doc.title}
          </a>
        ))}
      </div>
      {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
      {me.data && data.data ? (
        <TaskDesk
          cards={cards}
          role={role}
          busyId={busyId}
          drive={Boolean(data.data.drive)}
          photoSrc={staffThumb}
          onStatus={(task, status) => void setStatus(task, status)}
          onPhoto={(task, file) => void upload(task, file)}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Đang xếp việc…</p>
      )}
      <p className="sr-only">{LIST_LABEL.setup}</p>
    </div>
  );
}
