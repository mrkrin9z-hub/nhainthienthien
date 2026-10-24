import type { TaskCard } from "@/domain/checklists";

const STATUS_LABEL = { chua_lam: "Cần làm", dang_lam: "Đang làm", xong: "Xong" } as const;

export function TaskBoard({
  cards,
  busyId,
  onStatus,
  onPhoto,
  photoSrc,
}: {
  cards: TaskCard[];
  busyId: string | null;
  onStatus: (task: TaskCard, status: TaskCard["status"]) => void;
  onPhoto: (task: TaskCard, file: File) => void;
  photoSrc?: (id: string) => string;
}) {
  const sections = new Map<string, TaskCard[]>();
  for (const card of cards) {
    const key = card.section || card.listLabel;
    const list = sections.get(key) ?? [];
    list.push(card);
    sections.set(key, list);
  }
  if (!cards.length) return <p className="text-sm text-muted-foreground">Không có việc trong mục này.</p>;
  return (
    <div className="space-y-4">
      {[...sections.entries()].map(([section, rows]) => (
        <section key={section} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{section}</h2>
          {rows.map((task) => (
            <article key={task.id} id={`viec-${task.id}`} className="space-y-2 rounded-2xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold leading-snug">{task.title}</h3>
                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${task.status === "xong" ? "bg-emerald-100 text-emerald-800" : task.status === "dang_lam" ? "bg-amber-100 text-amber-900" : "bg-muted text-muted-foreground"}`}>
                  {STATUS_LABEL[task.status]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {task.owner}
                {task.due ? ` · hạn ${task.due.split("-").reverse().join("/")}` : ""}
                {task.draft ? " · chỉ tiêu nháp" : ""}
                {task.fileCount ? ` · ${task.fileCount} ảnh` : ""}
              </p>
              {task.detail ? <p className="text-sm leading-snug whitespace-pre-line">{task.detail}</p> : null}
              {task.note ? <p className="text-sm leading-snug whitespace-pre-line text-muted-foreground">{task.note}</p> : null}
              {task.link ? (
                <a href={task.link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">
                  Mở tài liệu
                </a>
              ) : null}
              {photoSrc && task.fileIds.length ? (
                <div className="flex gap-2 overflow-x-auto">
                  {task.fileIds.slice(0, 4).map((id) => (
                    <img key={id} src={photoSrc(id)} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  ))}
                </div>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                {(["chua_lam", "dang_lam", "xong"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={busyId === task.id}
                    className={`min-h-11 rounded-xl text-sm font-semibold ${task.status === status ? "bg-primary text-primary-foreground" : "border bg-background"}`}
                    onClick={() => onStatus(task, status)}
                  >
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
              {task.needsProof ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Ảnh lưu tại {task.driveFolder}</p>
                  <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-dashed text-sm font-semibold">
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
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
