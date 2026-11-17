import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toJpeg } from "html-to-image";
import { ImagePlus, Send, Trash2, Undo2 } from "lucide-react";

import { HubBack } from "@/components/admin/access-hub";
import { FeedbackMockPhone } from "@/components/admin/feedback-mock-phone";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  cloneDraft,
  FEEDBACK_TEMPLATES,
  newLineId,
  platformLabel,
  type FeedbackDraft,
  type FeedbackPlatform,
  type FeedbackSide,
} from "@/domain/feedback-mock";

export const Route = createFileRoute("/admin/feedback-gia")({
  component: () => (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale dùng trang này.">
      <FeedbackMockPage />
    </RoleGate>
  ),
});

function FeedbackMockPage() {
  const [templateId, setTemplateId] = useState(FEEDBACK_TEMPLATES[0]!.id);
  const [draft, setDraft] = useState<FeedbackDraft>(() => cloneDraft(FEEDBACK_TEMPLATES[0]!.draft));
  const [exporting, setExporting] = useState(false);
  const [customerDraft, setCustomerDraft] = useState("");
  const [shopDraft, setShopDraft] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const customerImageRef = useRef<HTMLInputElement>(null);
  const shopImageRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<FeedbackDraft[]>([]);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const template = useMemo(
    () => FEEDBACK_TEMPLATES.find((item) => item.id === templateId) ?? FEEDBACK_TEMPLATES[0]!,
    [templateId],
  );

  function pushHistory(snapshot: FeedbackDraft) {
    historyRef.current = [...historyRef.current.slice(-39), cloneDraft(snapshot)];
    setCanUndo(true);
  }

  function mutateDraft(recipe: (current: FeedbackDraft) => FeedbackDraft) {
    const current = draftRef.current;
    pushHistory(current);
    const next = recipe(current);
    draftRef.current = next;
    setDraft(next);
  }

  function undoLast() {
    const prev = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    if (!prev) {
      toast.error("Không còn thao tác để quay lại.");
      return;
    }
    draftRef.current = prev;
    setDraft(prev);
    setSelectedId(null);
    toast.success("Đã hoàn tác.");
  }

  function applyTemplate(id: string) {
    const next = FEEDBACK_TEMPLATES.find((item) => item.id === id) ?? FEEDBACK_TEMPLATES[0]!;
    setTemplateId(next.id);
    mutateDraft(() => cloneDraft(next.draft));
    setSelectedId(null);
  }

  function send(side: FeedbackSide, text: string, clear: () => void) {
    const value = text.trim();
    if (!value) return;
    const id = newLineId();
    mutateDraft((current) => ({
      ...current,
      lines: [
        ...current.lines.filter((line) => line.kind !== "status"),
        {
          id,
          kind: "text" as const,
          side,
          text: value,
          showAvatar: side === "customer",
        },
        ...(side === "shop" ? [{ id: newLineId(), kind: "status" as const, text: "Đã gửi" }] : []),
      ],
    }));
    setSelectedId(id);
    clear();
  }

  function addSticker(side: FeedbackSide) {
    const id = newLineId();
    mutateDraft((current) => ({
      ...current,
      lines: [...current.lines, { id, kind: "sticker", side, sticker: "thumb" }],
    }));
    setSelectedId(id);
  }

  function sendImage(side: FeedbackSide, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Chọn file ảnh.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Ảnh quá lớn (tối đa 8MB, chỉ lưu local).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      if (!src) {
        toast.error("Không đọc được ảnh.");
        return;
      }
      const id = newLineId();
      mutateDraft((current) => ({
        ...current,
        lines: [
          ...current.lines.filter((line) => line.kind !== "status"),
          {
            id,
            kind: "image" as const,
            side,
            src,
            showAvatar: side === "customer",
          },
          ...(side === "shop" ? [{ id: newLineId(), kind: "status" as const, text: "Đã gửi" }] : []),
        ],
      }));
      setSelectedId(id);
      toast.success("Đã gắn ảnh local (không lưu server).");
    };
    reader.onerror = () => toast.error("Không đọc được ảnh.");
    reader.readAsDataURL(file);
  }

  function addDate() {
    const id = newLineId();
    mutateDraft((current) => ({
      ...current,
      lines: [...current.lines, { id, kind: "date", text: "Hôm nay" }],
    }));
    setSelectedId(id);
  }

  function addHeart() {
    if (!selectedId) {
      toast.error("Chạm một tin trên khung xuất trước.");
      return;
    }
    mutateDraft((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.id === selectedId && (line.kind === "text" || line.kind === "sticker" || line.kind === "image")
          ? { ...line, hearts: (line.hearts ?? 0) + 1 }
          : line,
      ),
    }));
  }

  function removeLine(id: string) {
    mutateDraft((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.id !== id),
    }));
    setSelectedId((current) => (current === id ? null : current));
  }

  function removeSelected() {
    if (!selectedId) {
      toast.error("Chạm một tin trên khung xuất trước.");
      return;
    }
    removeLine(selectedId);
  }

  function onAvatar(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Chọn file ảnh.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      mutateDraft((current) => ({ ...current, customerAvatar: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  }

  /** Blur contentEditable để commit chữ đang sửa vào state trước khi xuất. */
  function flushLiveEdits(root: HTMLElement) {
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.contains(active)) active.blur();
  }

  async function exportJpg() {
    const node = document.getElementById("feedback-mock-capture");
    if (!node) {
      toast.error("Không thấy khung xem trước.");
      return;
    }
    setExporting(true);
    flushLiveEdits(node);
    // Không setSelectedId trước capture — tránh remount/reset chữ live.
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    await new Promise((resolve) => setTimeout(resolve, 80));

    const thread = node.querySelector<HTMLElement>("[data-thread-scroll='1']");
    const threadPrev = thread
      ? {
          maxHeight: thread.style.maxHeight,
          overflow: thread.style.overflow,
          minHeight: thread.style.minHeight,
        }
      : null;
    const hidden: Array<{ el: HTMLElement; display: string }> = [];
    node.querySelectorAll<HTMLElement>("[data-export-hide='1']").forEach((el) => {
      hidden.push({ el, display: el.style.display });
      el.style.display = "none";
    });
    const rings: Array<{ el: HTMLElement; className: string }> = [];
    node.querySelectorAll<HTMLElement>(".ring-2").forEach((el) => {
      rings.push({ el, className: el.className });
      el.classList.remove("ring-2", "ring-[#1874FC]/35");
    });
    if (thread) {
      thread.style.maxHeight = "none";
      thread.style.overflow = "visible";
      thread.style.minHeight = "0";
    }

    try {
      const dataUrl = await toJpeg(node, {
        quality: 0.96,
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#eef1f5",
        width: node.scrollWidth,
        height: node.scrollHeight,
        style: {
          transform: "none",
          overflow: "visible",
        },
      });
      const link = document.createElement("a");
      const safe =
        draftRef.current.customerName.replace(/[^\w\u00C0-\u024F\s-]/gi, "").trim().replace(/\s+/g, "-") ||
        "feedback";
      link.download = `feedback-${safe}-${Date.now()}.jpg`;
      link.href = dataUrl;
      link.click();
      toast.success("Đã xuất JPG đúng khung live.");
      setSelectedId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xuất được ảnh.");
    } finally {
      if (thread && threadPrev) {
        thread.style.maxHeight = threadPrev.maxHeight;
        thread.style.overflow = threadPrev.overflow;
        thread.style.minHeight = threadPrev.minHeight;
      }
      hidden.forEach(({ el, display }) => {
        el.style.display = display;
      });
      rings.forEach(({ el, className }) => {
        el.className = className;
      });
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <HubBack to="/admin/media" label="Kho source" search={{ m: "drive" }} />
          <h1 className="mt-2 text-2xl font-extrabold text-primary">Tạo feedback giả</h1>
          <p className="text-sm text-muted-foreground">
            Chat live 2 phía → sửa chữ trực tiếp trên khung iPhone → xuất JPG. Mẫu: {template.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={!canUndo} onClick={undoLast}>
            <Undo2 className="mr-1 size-4" /> Quay lại
          </Button>
          <Button type="button" className="min-h-11" disabled={exporting} onClick={() => void exportJpg()}>
            {exporting ? "Đang xuất…" : "Xuất JPG"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
        <div className="flex w-full flex-wrap gap-2">
          {FEEDBACK_TEMPLATES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={templateId === item.id ? "default" : "outline"}
              className="min-h-10"
              onClick={() => applyTemplate(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["zalo", "zalo_classic", "messenger"] as FeedbackPlatform[]).map((platform) => (
            <Button
              key={platform}
              type="button"
              size="sm"
              variant={draft.platform === platform ? "default" : "outline"}
              className="min-h-10"
              onClick={() => setDraft((current) => ({ ...current, platform }))}
            >
              {platformLabel(platform)}
            </Button>
          ))}
        </div>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()}>
          Avatar khách
        </Button>
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
        <label className="flex items-center gap-2 px-2 text-sm">
          <input
            type="checkbox"
            checked={draft.showKeyboard}
            onChange={(event) => setDraft((current) => ({ ...current, showKeyboard: event.target.checked }))}
          />
          Bàn phím
        </label>
        <label className="flex items-center gap-2 px-2 text-sm">
          <input
            type="checkbox"
            checked={draft.stranger}
            onChange={(event) => setDraft((current) => ({ ...current, stranger: event.target.checked }))}
          />
          Người lạ
        </label>
        <label className="flex items-center gap-2 px-2 text-sm">
          <input
            type="checkbox"
            checked={draft.callbackBanner}
            onChange={(event) => setDraft((current) => ({ ...current, callbackBanner: event.target.checked }))}
          />
          Gọi lại
        </label>
        <label className="flex items-center gap-2 px-2 text-sm">
          Pin
          <Input
            className="min-h-9 w-16"
            type="number"
            min={1}
            max={100}
            value={draft.battery}
            onChange={(event) => setDraft((current) => ({ ...current, battery: Number(event.target.value) || 1 }))}
          />
        </label>
        <label className="flex items-center gap-2 px-2 text-sm">
          <input
            type="checkbox"
            checked={draft.charging}
            onChange={(event) => setDraft((current) => ({ ...current, charging: event.target.checked }))}
          />
          Sạc
        </label>
        <Button type="button" variant="outline" className="min-h-11" onClick={addDate}>
          + Ngày
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => addSticker("customer")}>
          + Sticker khách
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={addHeart}>
          + ❤️ tin đang chọn
        </Button>
        <Button type="button" variant="outline" className="min-h-11 text-destructive" onClick={removeSelected}>
          <Trash2 className="mr-1 size-4" /> Xóa tin chọn
        </Button>
        <Button type="button" variant="outline" className="min-h-11" disabled={!canUndo} onClick={undoLast}>
          <Undo2 className="mr-1 size-4" /> Quay lại / hoàn tác
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border bg-[#f7f8fa] p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-white text-xs font-bold shadow">
                  {(draft.customerName[0] || "K").toUpperCase()}
                </span>
                <div>
                  <p className="text-sm font-semibold">Chat phía khách</p>
                  <p className="text-xs text-muted-foreground">Tin trái · bong bóng trắng</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  className="min-h-11 bg-white"
                  placeholder="Khách nhắn…"
                  value={customerDraft}
                  onChange={(event) => setCustomerDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") send("customer", customerDraft, () => setCustomerDraft(""));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 shrink-0"
                  title="Gửi ảnh local (không lưu server)"
                  onClick={() => customerImageRef.current?.click()}
                >
                  <ImagePlus className="size-4" />
                </Button>
                <Button
                  type="button"
                  className="min-h-11 shrink-0"
                  onClick={() => send("customer", customerDraft, () => setCustomerDraft(""))}
                >
                  <Send className="size-4" />
                </Button>
              </div>
              <input
                ref={customerImageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  sendImage("customer", event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Ảnh đẹp lắm ạ", "Ưng lắm e", "Nhận rồi ạ"].map((phrase) => (
                  <Button
                    key={phrase}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={() => send("customer", phrase, () => setCustomerDraft(""))}
                  >
                    {phrase}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-[#e8f2ff] p-3 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-[#0068ff] text-xs font-bold text-white">S</span>
                <div>
                  <p className="text-sm font-semibold">Chat phía shop</p>
                  <p className="text-xs text-muted-foreground">Tin phải · bong bóng xanh</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  className="min-h-11 bg-white"
                  placeholder="Shop trả lời…"
                  value={shopDraft}
                  onChange={(event) => setShopDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") send("shop", shopDraft, () => setShopDraft(""));
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 shrink-0 bg-white"
                  title="Gửi ảnh local (không lưu server)"
                  onClick={() => shopImageRef.current?.click()}
                >
                  <ImagePlus className="size-4" />
                </Button>
                <Button type="button" className="min-h-11 shrink-0 bg-[#0068ff] hover:bg-[#0056d6]" onClick={() => send("shop", shopDraft, () => setShopDraft(""))}>
                  <Send className="size-4" />
                </Button>
              </div>
              <input
                ref={shopImageRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  sendImage("shop", event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["dạ em cảm ơn ạ", "có dịp ủng hộ tiệm em nhé ạ"].map((phrase) => (
                  <Button
                    key={phrase}
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    onClick={() => send("shop", phrase, () => setShopDraft(""))}
                  >
                    {phrase}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">Sửa live trên khung xuất</p>
            <p className="mt-1">
              Chạm vào tên, trạng thái, giờ, hoặc nội dung bong bóng để gõ trực tiếp. Chạm một tin rồi bấm nút × trên tin / Xóa tin
              chọn, hoặc Quay lại để hoàn tác tin vừa gửi. Ảnh chỉ giữ local để xuất JPG.
            </p>
          </div>
        </section>

        <section className="xl:sticky xl:top-4 xl:self-start">
          <div className="mb-2 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-9" disabled={!canUndo} onClick={undoLast}>
              <Undo2 className="mr-1 size-4" /> Quay lại
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9 text-destructive"
              disabled={!selectedId}
              onClick={removeSelected}
            >
              <Trash2 className="mr-1 size-4" /> Xóa tin đang chọn
            </Button>
          </div>
          <div className="overflow-auto rounded-xl border bg-slate-300/50 p-3">
            <FeedbackMockPhone
              draft={draft}
              live
              selectedId={selectedId}
              onSelectLine={setSelectedId}
              onChange={setDraft}
              onDeleteLine={removeLine}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
