import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toJpeg } from "html-to-image";

import { FeedbackMockPhone } from "@/components/admin/feedback-mock-phone";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cloneDraft,
  emptyTextLine,
  FEEDBACK_TEMPLATES,
  newLineId,
  platformLabel,
  type FeedbackDraft,
  type FeedbackLine,
  type FeedbackPlatform,
  type FeedbackSide,
} from "@/domain/feedback-mock";

export const Route = createFileRoute("/admin/feedback-gia")({
  component: () => (
    <RoleGate allow={["owner", "sale"]}>
      <FeedbackMockPage />
    </RoleGate>
  ),
});

function FeedbackMockPage() {
  const [templateId, setTemplateId] = useState(FEEDBACK_TEMPLATES[0]!.id);
  const [draft, setDraft] = useState<FeedbackDraft>(() => cloneDraft(FEEDBACK_TEMPLATES[0]!.draft));
  const [exporting, setExporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const template = useMemo(() => FEEDBACK_TEMPLATES.find((item) => item.id === templateId) ?? FEEDBACK_TEMPLATES[0]!, [templateId]);

  function applyTemplate(id: string) {
    const next = FEEDBACK_TEMPLATES.find((item) => item.id === id) ?? FEEDBACK_TEMPLATES[0]!;
    setTemplateId(next.id);
    setDraft(cloneDraft(next.draft));
  }

  function patch(partial: Partial<FeedbackDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function updateLine(id: string, patchLine: Partial<FeedbackLine>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (line.id === id ? ({ ...line, ...patchLine } as FeedbackLine) : line)),
    }));
  }

  function removeLine(id: string) {
    setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) }));
  }

  function addLine(side: FeedbackSide) {
    setDraft((current) => ({ ...current, lines: [...current.lines, emptyTextLine(side)] }));
  }

  function addDate() {
    setDraft((current) => ({
      ...current,
      lines: [...current.lines, { id: newLineId(), kind: "date", text: "Hôm nay" }],
    }));
  }

  function addSticker(side: FeedbackSide) {
    setDraft((current) => ({
      ...current,
      lines: [...current.lines, { id: newLineId(), kind: "sticker", side, sticker: "thumb" }],
    }));
  }

  function onAvatar(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Chọn file ảnh.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ customerAvatar: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  async function exportJpg() {
    const node = document.getElementById("feedback-mock-capture");
    if (!node) {
      toast.error("Không thấy khung xem trước.");
      return;
    }
    setExporting(true);
    try {
      const dataUrl = await toJpeg(node, {
        quality: 0.95,
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#eef1f5",
      });
      const link = document.createElement("a");
      const safe = draft.customerName.replace(/[^\w\u00C0-\u024F\s-]/gi, "").trim().replace(/\s+/g, "-") || "feedback";
      link.download = `feedback-${safe}-${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
      toast.success("Đã xuất JPG.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xuất được ảnh.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Tạo feedback giả</h1>
          <p className="text-sm text-muted-foreground">
            Giả lập chat Zalo / Messenger kiểu ảnh chụp iPhone. Chọn mẫu, sửa tên·avatar·tin nhắn, xuất JPG.
          </p>
        </div>
        <Button type="button" className="min-h-11" disabled={exporting} onClick={() => void exportJpg()}>
          {exporting ? "Đang xuất…" : "Xuất JPG"}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Mẫu</span>
              <select
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={templateId}
                onChange={(event) => applyTemplate(event.target.value)}
              >
                {FEEDBACK_TEMPLATES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Giao diện</span>
              <select
                className="min-h-11 w-full rounded-md border bg-background px-3"
                value={draft.platform}
                onChange={(event) => patch({ platform: event.target.value as FeedbackPlatform })}
              >
                {(["zalo", "zalo_classic", "messenger"] as FeedbackPlatform[]).map((platform) => (
                  <option key={platform} value={platform}>
                    {platformLabel(platform)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Tên khách</span>
              <Input className="min-h-11" value={draft.customerName} onChange={(event) => patch({ customerName: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Trạng thái / đã xem</span>
              <Input className="min-h-11" value={draft.statusText} onChange={(event) => patch({ statusText: event.target.value })} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              {draft.customerAvatar ? (
                <img src={draft.customerAvatar} alt="" className="size-12 rounded-full object-cover" />
              ) : (
                <span className="grid size-12 place-items-center rounded-full bg-slate-200 text-sm font-bold">?</span>
              )}
              <div className="space-y-1">
                <Button type="button" variant="outline" className="min-h-10" onClick={() => fileRef.current?.click()}>
                  Đổi avatar khách
                </Button>
                {draft.customerAvatar ? (
                  <button type="button" className="block text-xs text-muted-foreground underline" onClick={() => patch({ customerAvatar: "" })}>
                    Xóa avatar
                  </button>
                ) : null}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  onAvatar(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.stranger} onChange={(event) => patch({ stranger: event.target.checked })} />
              Người lạ + Kết bạn (Zalo xanh)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.showKeyboard} onChange={(event) => patch({ showKeyboard: event.target.checked })} />
              Hiện bàn phím iPhone
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Giờ</span>
              <Input className="min-h-11" value={draft.clock} onChange={(event) => patch({ clock: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Pin %</span>
              <Input
                className="min-h-11"
                type="number"
                min={1}
                max={100}
                value={draft.battery}
                onChange={(event) => patch({ battery: Number(event.target.value) || 1 })}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Badge chưa đọc</span>
              <Input className="min-h-11" value={draft.unreadBadge} onChange={(event) => patch({ unreadBadge: event.target.value })} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-semibold">Ô nhập</span>
              <Input className="min-h-11" value={draft.inputHint} onChange={(event) => patch({ inputHint: event.target.value })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.charging} onChange={(event) => patch({ charging: event.target.checked })} />
            Đang sạc
          </label>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-primary">Tin nhắn</h2>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-9" onClick={() => addLine("customer")}>
                  + Khách
                </Button>
                <Button type="button" variant="outline" className="min-h-9" onClick={() => addLine("shop")}>
                  + Shop
                </Button>
                <Button type="button" variant="outline" className="min-h-9" onClick={() => addSticker("customer")}>
                  + Sticker
                </Button>
                <Button type="button" variant="outline" className="min-h-9" onClick={addDate}>
                  + Ngày
                </Button>
              </div>
            </div>
            <ul className="space-y-2">
              {draft.lines.map((line, index) => (
                <li key={line.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>
                      #{index + 1} · {line.kind}
                      {line.kind === "text" || line.kind === "sticker" ? ` · ${line.side}` : ""}
                    </span>
                    <button type="button" className="ml-auto text-destructive" onClick={() => removeLine(line.id)}>
                      Xóa
                    </button>
                  </div>
                  {line.kind === "date" || line.kind === "status" ? (
                    <Input
                      className="min-h-10"
                      value={line.text}
                      onChange={(event) => updateLine(line.id, { text: event.target.value })}
                    />
                  ) : null}
                  {line.kind === "text" ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="min-h-10 rounded-md border bg-background px-2 text-sm"
                          value={line.side}
                          onChange={(event) => updateLine(line.id, { side: event.target.value as FeedbackSide })}
                        >
                          <option value="customer">Khách (trái)</option>
                          <option value="shop">Shop (phải)</option>
                        </select>
                        <Input
                          className="min-h-10 w-24"
                          placeholder="Giờ"
                          value={line.time ?? ""}
                          onChange={(event) => updateLine(line.id, { time: event.target.value })}
                        />
                        <Input
                          className="min-h-10 w-24"
                          type="number"
                          min={0}
                          placeholder="❤️"
                          value={line.hearts ?? ""}
                          onChange={(event) =>
                            updateLine(line.id, { hearts: event.target.value ? Number(event.target.value) : undefined })
                          }
                        />
                        {line.side === "customer" ? (
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="checkbox"
                              checked={line.showAvatar !== false}
                              onChange={(event) => updateLine(line.id, { showAvatar: event.target.checked })}
                            />
                            Avatar
                          </label>
                        ) : null}
                      </div>
                      <Textarea
                        className="min-h-20"
                        value={line.text}
                        onChange={(event) => updateLine(line.id, { text: event.target.value })}
                      />
                    </div>
                  ) : null}
                  {line.kind === "sticker" ? (
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="min-h-10 rounded-md border bg-background px-2 text-sm"
                        value={line.side}
                        onChange={(event) => updateLine(line.id, { side: event.target.value as FeedbackSide })}
                      >
                        <option value="customer">Khách</option>
                        <option value="shop">Shop</option>
                      </select>
                      <select
                        className="min-h-10 rounded-md border bg-background px-2 text-sm"
                        value={line.sticker}
                        onChange={(event) => updateLine(line.id, { sticker: event.target.value as "thumb" | "1010" })}
                      >
                        <option value="thumb">Like xanh</option>
                        <option value="1010">10/10</option>
                      </select>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Mẫu đang mở: {template.label}</p>
          </div>
        </section>

        <section className="xl:sticky xl:top-4 xl:self-start">
          <div className="overflow-auto rounded-xl border bg-slate-200/60 p-3">
            <FeedbackMockPhone draft={draft} />
          </div>
        </section>
      </div>
    </div>
  );
}
