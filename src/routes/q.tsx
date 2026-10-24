import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useStaffPin } from "@/components/staff-pin";
import { TaskBoard } from "@/components/task-board";
import { LIST_LABEL, TASK_DOCS, type ChecklistListId, type TaskCard } from "@/domain/checklists";
import { loadPhoneTasks, savePhoneTaskStatus, staffPinStatus } from "@/lib/phone.functions";

export const Route = createFileRoute("/q")({
  validateSearch: (search: Record<string, unknown>): { v: string } => ({
    v: typeof search.v === "string" ? search.v : "",
  }),
  head: () => ({ meta: [{ title: "Việc cần làm | Nhà In Thiên Thiên" }, { name: "robots", content: "noindex" }] }),
  component: PhoneTasks,
});

const CHIPS: { id: ChecklistListId | "hom_nay" | "can_chup" | "quay_video"; label: string }[] = [
  { id: "hom_nay", label: "Hôm nay" },
  { id: "sale_tuan", label: "Tuần" },
  { id: "setup", label: "Setup" },
  { id: "khai_truong", label: "Khai trương" },
  { id: "chot", label: "24 việc" },
  { id: "can_chup", label: "Cần chụp" },
  { id: "quay_video", label: "Quay video" },
  { id: "anh", label: "Ảnh" },
  { id: "dao_tao", label: "Đào tạo" },
];

function PhoneTasks() {
  const { v } = Route.useSearch();
  const pinState = useStaffPin();
  const ready = useQuery({ queryKey: ["staff-pin"], queryFn: () => staffPinStatus() });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [list, setList] = useState<(typeof CHIPS)[number]["id"]>("hom_nay");
  const [busyId, setBusyId] = useState<string | null>(null);
  const client = useQueryClient();
  const tasks = useQuery({
    queryKey: ["phone-tasks", pinState.pin],
    queryFn: () => loadPhoneTasks({ data: { pin: pinState.pin } }),
    enabled: pinState.pin.length === 4,
    retry: false,
  });

  const cards = useMemo(() => {
    const rows = tasks.data?.cards ?? [];
    const picked = rows.filter((card) => {
      if (list === "can_chup") return card.section === "Cần chụp";
      if (list === "quay_video") return card.section === "Quay video";
      if (list === "hom_nay") return card.list === "sale_ngay" || card.list === "sop";
      return card.list === list;
    });
    if (!v) return picked;
    return [...picked].sort((a, b) => (a.id === v ? -1 : b.id === v ? 1 : 0));
  }, [tasks.data?.cards, list, v]);

  async function enter(next: string) {
    setError("");
    pinState.save(next);
  }

  async function setStatus(task: TaskCard, status: TaskCard["status"]) {
    setBusyId(task.id);
    setError("");
    try {
      await savePhoneTaskStatus({ data: { pin: pinState.pin, taskId: task.id, status } });
      await client.invalidateQueries({ queryKey: ["phone-tasks"] });
    } catch (reason) {
      const message = (reason as Error).message;
      if (/PIN/.test(message)) pinState.clear();
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  async function upload(task: TaskCard, file: File) {
    setBusyId(task.id);
    setError("");
    const body = new FormData();
    body.set("pin", pinState.pin);
    body.set("taskId", task.id);
    body.set("file", file);
    try {
      const response = await fetch("/api/public/staff-photo", { method: "POST", body });
      if (!response.ok) throw new Error(await response.text());
      await client.invalidateQueries({ queryKey: ["phone-tasks"] });
    } catch (reason) {
      const message = (reason as Error).message;
      if (/PIN/.test(message)) pinState.clear();
      setError(message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-4 bg-background px-3 py-4 pb-16">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nhà In Thiên Thiên</p>
        <h1 className="text-2xl font-extrabold">Việc cần làm</h1>
      </header>
      {ready.data && !ready.data.set ? (
        <p className="rounded-2xl border bg-card p-4 text-sm">Chủ chưa đặt mã PIN 4 số. Vào Cài đặt, mục Cửa hàng, rồi mở lại trang này.</p>
      ) : null}
      {ready.data?.set && pinState.pin.length !== 4 ? <PinPad value={draft} error={error} onChange={setDraft} onDone={(next) => void enter(next)} /> : null}
      {pinState.pin.length === 4 ? (
        <>
          <p className="text-sm text-muted-foreground">
            {tasks.data?.drive ? "Ảnh chứng lên Google Drive theo nhóm việc ghi trên thẻ." : "Ảnh chứng lưu trên máy chủ, mỗi ảnh tối đa 10MB. Drive chưa nối."}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            {TASK_DOCS.map((doc) => (
              <a key={doc.href} href={doc.href} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">
                {doc.title}
              </a>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`min-h-11 shrink-0 rounded-full px-3 text-sm font-semibold ${list === chip.id ? "bg-primary text-primary-foreground" : "border bg-card"}`}
                onClick={() => setList(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {tasks.isError ? <p className="text-sm font-semibold text-destructive">{(tasks.error as Error).message}</p> : null}
          {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
          {tasks.isLoading ? <p className="text-sm text-muted-foreground">Đang tải việc…</p> : <TaskBoard cards={cards} busyId={busyId} onStatus={(task, status) => void setStatus(task, status)} onPhoto={(task, file) => void upload(task, file)} />}
          <button type="button" className="min-h-11 text-sm font-semibold text-muted-foreground" onClick={() => pinState.clear()}>
            Đổi mã PIN
          </button>
          <details className="rounded-2xl border bg-card p-3 text-sm">
            <summary className="cursor-pointer font-semibold">Nội quy</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {(tasks.data?.rules ?? []).map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
      <p className="sr-only">{LIST_LABEL.sale_ngay}</p>
    </main>
  );
}

function PinPad({ value, error, onChange, onDone }: { value: string; error: string; onChange: (value: string) => void; onDone: (pin: string) => void }) {
  function press(digit: string) {
    const next = `${value}${digit}`.slice(0, 4);
    onChange(next);
    if (next.length === 4) onDone(next);
  }
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="text-lg font-bold">Mã PIN nhân viên</h2>
      <p className="text-sm text-muted-foreground">4 chữ số. Không cần đăng nhập email.</p>
      <p className="text-center font-mono text-3xl tracking-[0.4em]" aria-live="polite">{value.padEnd(4, "·")}</p>
      {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "x", "0", "⌫"].map((key) => (
          <button
            key={key}
            type="button"
            className="min-h-14 rounded-xl border text-xl font-semibold"
            onClick={() => {
              if (key === "x") return;
              if (key === "⌫") onChange(value.slice(0, -1));
              else press(key);
            }}
          >
            {key === "x" ? "" : key}
          </button>
        ))}
      </div>
    </section>
  );
}
