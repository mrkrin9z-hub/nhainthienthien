import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { staffThumb } from "@/components/photo-thumb";
import { TaskBoard } from "@/components/task-board";
import { LIST_LABEL, TASK_DOCS, type ChecklistListId, type TaskCard } from "@/domain/checklists";
import { loadChecklist, saveChecklistStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/viec")({
  component: ChecklistPage,
});

const CHIPS: { id: ChecklistListId | "hom_nay" | "thieu" | "can_chup" | "quay_video"; label: string }[] = [
  { id: "hom_nay", label: "Hôm nay" },
  { id: "sale_tuan", label: "Tuần" },
  { id: "setup", label: "Setup" },
  { id: "khai_truong", label: "Khai trương" },
  { id: "chot", label: "24 việc" },
  { id: "can_chup", label: "Cần chụp" },
  { id: "quay_video", label: "Quay video" },
  { id: "anh", label: "Ảnh" },
  { id: "dao_tao", label: "Đào tạo" },
  { id: "thieu", label: "Sheet còn thiếu" },
];

function ChecklistPage() {
  const data = useQuery({ queryKey: ["checklist"], queryFn: () => loadChecklist() });
  const client = useQueryClient();
  const [list, setList] = useState<(typeof CHIPS)[number]["id"]>("hom_nay");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const cards = useMemo(() => {
    const rows = data.data?.cards ?? [];
    const needle = q.trim().toLowerCase();
    const filtered = rows.filter((card) => {
      if (list === "thieu") return false;
      if (list === "can_chup") return card.section === "Cần chụp";
      if (list === "quay_video") return card.section === "Quay video";
      if (list === "hom_nay" && card.list !== "sale_ngay" && card.list !== "sop") return false;
      if (list !== "hom_nay" && list !== "thieu" && card.list !== list) return false;
      if (!needle) return true;
      return `${card.title} ${card.owner} ${card.detail} ${card.note} ${card.link}`.toLowerCase().includes(needle);
    });
    return filtered;
  }, [data.data?.cards, list, q]);

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

  const today = data.data?.today ?? "";
  const open = (data.data?.cards ?? []).filter((card) => card.status !== "xong" && (card.repeat !== "once" || (card.due !== null && card.due <= today))).length;

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Việc cần làm"
        hint={data.data ? `${open} việc tới hạn hoặc trong ca. Nhân viên mở /q trên điện thoại, nhập PIN 4 số.` : "Đang tải…"}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm việc, người làm…"
      />
      <p className="text-sm text-muted-foreground">
        {data.data?.pinSet ? "Đã có mã PIN điện thoại." : "Chưa có PIN. Đặt 4 số ở Cài đặt → Cửa hàng."}{" "}
        {data.data?.drive ? "Ảnh điện thoại lên Google Drive." : "Drive chưa nối: ảnh điện thoại lưu trên máy chủ, tối đa 10MB."}
      </p>
      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-3 text-sm">
        {TASK_DOCS.map((doc) => (
          <a key={doc.href} href={doc.href} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
            {doc.title}
          </a>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold ${list === chip.id ? "bg-primary text-primary-foreground" : "border bg-card"}`}
            onClick={() => setList(chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
      {list === "thieu" ? (
        <ul className="space-y-2">
          {(data.data?.coverage ?? []).map((row) => (
            <li key={row.sheet} className="rounded-xl border bg-card p-3 text-sm">
              <p className="font-semibold">{row.sheet}</p>
              <p>Trong app: {row.inApp}</p>
              {row.gap ? <p className="text-amber-800">Còn: {row.gap}</p> : <p className="text-emerald-800">Đã có trong app.</p>}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <TaskBoard cards={cards} busyId={busyId} photoSrc={staffThumb} onStatus={(task, status) => void setStatus(task, status)} onPhoto={(task, file) => void upload(task, file)} />
        </>
      )}
      <p className="sr-only">{LIST_LABEL.setup}</p>
    </div>
  );
}
