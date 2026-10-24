import { useMemo, useState } from "react";

import type { DeskAssignee, TaskCard } from "@/domain/checklists";
import { ASSIGNEE_LABEL, LIST_LABEL, STATUS_WORD, mineAssignee, type ChecklistListId } from "@/domain/checklists";
import type { Role } from "@/domain/types";

const ASSIGNEES: DeskAssignee[] = ["admin", "sale", "production"];
const STATUSES = ["chua_lam", "dang_lam", "xong"] as const;

const PRIORITY_TONE: Record<TaskCard["priority"], string> = {
  cao: "bg-red-50 text-red-700",
  vua: "bg-amber-50 text-amber-800",
  thap: "bg-slate-100 text-slate-600",
};

const ASSIGNEE_TONE: Record<DeskAssignee, string> = {
  admin: "bg-blue-50 text-blue-800",
  sale: "bg-violet-50 text-violet-800",
  production: "bg-emerald-50 text-emerald-800",
};

function dueLabel(due: string | null): string {
  if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return due ? `Hạn ${due}` : "Chưa hạn";
  const [year, month, day] = due.split("-");
  return `Hạn ${day}/${month}/${year}`;
}

function TaskCardView({
  task,
  busy,
  photoSrc,
  onStatus,
  onPhoto,
}: {
  task: TaskCard;
  busy: boolean;
  photoSrc?: (id: string) => string;
  onStatus: (task: TaskCard, status: TaskCard["status"]) => void;
  onPhoto: (task: TaskCard, file: File) => void;
}) {
  const blurb = task.detail || task.note;
  return (
    <article id={`viec-${task.id}`} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_TONE[task.priority]}`}>{task.priorityLabel}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${task.status === "xong" ? "bg-emerald-100 text-emerald-800" : task.status === "dang_lam" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
          {STATUS_WORD[task.status]}
        </span>
      </div>
      <h3 className="text-[15px] font-semibold leading-snug text-slate-900">{task.title}</h3>
      {blurb ? <p className="line-clamp-2 text-sm leading-snug text-slate-500">{blurb}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${ASSIGNEE_TONE[task.assignee]}`}>{task.assigneeLabel}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{task.listLabel}</span>
        <span className="text-slate-500">{dueLabel(task.due)}</span>
        {task.draft ? <span className="text-amber-700">Nháp</span> : null}
      </div>
      {task.link ? (
        <a href={task.link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 underline">
          Mở tài liệu
        </a>
      ) : null}
      {task.needsProof ? (
        <div className="rounded-xl bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Ảnh lưu tại</p>
          <p className="mt-0.5 break-words">{task.driveFolder}</p>
          {photoSrc && task.fileIds.length ? (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {task.fileIds.slice(0, 3).map((id) => (
                <img key={id} src={photoSrc(id)} alt="" className="size-14 rounded-lg object-cover" />
              ))}
            </div>
          ) : null}
          <label className="mt-2 flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-700">
            Tải ảnh chứng
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onPhoto(task, file);
              }}
            />
          </label>
        </div>
      ) : null}
      <div className="mt-auto flex items-center gap-2 pt-1">
        {task.status === "xong" ? (
          <button type="button" disabled={busy} className="min-h-11 flex-1 rounded-xl border text-sm font-semibold" onClick={() => onStatus(task, "chua_lam")}>
            Mở lại
          </button>
        ) : (
          <button type="button" disabled={busy} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-semibold text-white" onClick={() => onStatus(task, "xong")}>
            Xong
          </button>
        )}
        {task.status === "chua_lam" ? (
          <button type="button" disabled={busy} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-slate-500" onClick={() => onStatus(task, "dang_lam")}>
            Đang làm
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function TaskDesk({
  cards,
  role,
  busyId,
  drive,
  photoSrc,
  onStatus,
  onPhoto,
}: {
  cards: TaskCard[];
  role: Role;
  busyId: string | null;
  drive: boolean;
  photoSrc?: (id: string) => string;
  onStatus: (task: TaskCard, status: TaskCard["status"]) => void;
  onPhoto: (task: TaskCard, file: File) => void;
}) {
  const [who, setWho] = useState<"mine" | "all" | DeskAssignee>(role === "owner" ? "all" : "mine");
  const [group, setGroup] = useState<ChecklistListId | "all">("all");
  const [q, setQ] = useState("");
  const mine = mineAssignee(role);
  const picked = who === "mine" ? mine : who;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cards.filter((card) => {
      if (picked !== "all" && card.assignee !== picked) return false;
      if (group !== "all" && card.list !== group) return false;
      if (!needle) return true;
      return `${card.title} ${card.detail} ${card.assigneeLabel} ${card.listLabel}`.toLowerCase().includes(needle);
    });
  }, [cards, picked, group, q]);

  const byPerson = picked === "all";
  const columns = byPerson
    ? ASSIGNEES.map((id) => ({ id, label: ASSIGNEE_LABEL[id], rows: filtered.filter((card) => card.assignee === id) }))
    : STATUSES.map((id) => ({ id, label: STATUS_WORD[id], rows: filtered.filter((card) => card.status === id) }));

  const people = [
    { id: "mine" as const, label: "Việc của tôi" },
    { id: "admin" as const, label: "Admin" },
    { id: "sale" as const, label: "Sale" },
    { id: "production" as const, label: "Sản xuất" },
    { id: "all" as const, label: "Tất cả" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {people.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`min-h-10 rounded-full px-3 text-sm font-semibold ${who === item.id ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            onClick={() => setWho(item.id)}
          >
            {item.label}
          </button>
        ))}
        <label className="min-h-10">
          <span className="sr-only">Nhóm việc</span>
          <select
            className="h-10 rounded-full border border-slate-200 bg-white px-3 text-sm font-semibold"
            aria-label="Nhóm việc"
            value={group}
            onChange={(event) => setGroup(event.target.value as ChecklistListId | "all")}
          >
            <option value="all">Mọi nhóm</option>
            {(Object.keys(LIST_LABEL) as ChecklistListId[]).map((id) => (
              <option key={id} value={id}>
                {LIST_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Tìm việc…"
        aria-label="Tìm việc"
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
      />
      <p className="text-xs text-slate-500">
        {filtered.length} việc
        {byPerson ? " · xếp theo người làm" : ` · ${ASSIGNEE_LABEL[picked === "all" ? mine : picked]}`}
        {drive ? " · ảnh chứng lên Google Drive đúng thư mục trên thẻ." : " · Drive chưa nối: ảnh chứng lưu trên app, tối đa 10MB, vẫn ghi thư mục đích."}
      </p>
      <div className={`grid gap-3 ${columns.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        {columns.map((column) => (
          <section key={column.id} className="flex min-w-0 flex-col rounded-2xl bg-slate-100/80 p-2">
            <header className="flex items-center justify-between px-1 py-2">
              <h2 className="text-sm font-semibold text-slate-800">{column.label}</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500">{column.rows.length}</span>
            </header>
            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto pr-1">
              {column.rows.map((task) => (
                <TaskCardView key={task.id} task={task} busy={busyId === task.id} photoSrc={photoSrc} onStatus={onStatus} onPhoto={onPhoto} />
              ))}
              {column.rows.length === 0 ? <p className="px-2 py-6 text-center text-sm text-slate-400">Không có việc</p> : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
