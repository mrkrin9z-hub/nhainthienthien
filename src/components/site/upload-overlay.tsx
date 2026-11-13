import { AlertCircle, Check, Loader2, MessageCircle, RotateCcw } from "lucide-react";

export type UploadPhase = {
  step: "order" | "prepare" | "upload" | "finish" | "error";
  done: number;
  total: number;
  failed: number;
  percent: number;
  message?: string | undefined;
  /** Lỗi xảy ra trước khi tạo được đơn. */
  orderOnly?: boolean;
};

function Step({ state, label }: { state: "todo" | "doing" | "done" | "fail"; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full transition-colors duration-300 ${
          state === "done" ? "bg-brand-blue text-white" : state === "fail" ? "bg-destructive text-white" : state === "doing" ? "bg-cta/15 text-cta" : "bg-muted text-muted-foreground"
        }`}
      >
        {state === "done" ? <Check className="pop-in size-3.5" /> : state === "doing" ? <Loader2 className="size-3.5 animate-spin" /> : state === "fail" ? <AlertCircle className="size-3.5" /> : null}
      </span>
      <span className={state === "todo" ? "text-muted-foreground" : "text-foreground"}>{label}</span>
    </li>
  );
}

/** Màn tiến trình sau khi bấm Đặt hàng: Tạo đơn → Tải ảnh x/y – NN% → Hoàn tất. */
export function UploadOverlay({
  phase,
  busy,
  onRetry,
  onSendLater,
  onClose,
  messengerUrl,
}: {
  phase: UploadPhase;
  busy: boolean;
  onRetry: () => void;
  onSendLater?: (() => void) | undefined;
  onClose: () => void;
  messengerUrl: string;
}) {
  const hasPhotos = phase.total > 0;
  const orderState = phase.step === "order" ? "doing" : phase.step === "error" && phase.orderOnly ? "fail" : "done";
  const photoState =
    phase.step === "order" ? "todo" : phase.step === "prepare" || phase.step === "upload" ? "doing" : phase.step === "error" ? (phase.orderOnly ? "todo" : "fail") : "done";
  const finishState = phase.step === "finish" ? "doing" : "todo";
  const photoLabel =
    phase.step === "prepare"
      ? "Đang chuẩn bị ảnh…"
      : phase.step === "upload"
        ? `Đang tải ảnh ${Math.min(phase.done + 1, phase.total)}/${phase.total} – ${phase.percent}%`
        : phase.step === "error" && !phase.orderOnly
          ? `Đã gửi ${phase.done}/${phase.total} ảnh, ${phase.failed} ảnh lỗi`
          : `Tải ảnh (${phase.total} ảnh)`;
  const isError = phase.step === "error";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#123047]/35 sm:items-center" role="dialog" aria-modal="true" aria-live="polite">
      <div className="sheet-up glass-sheet w-full max-w-md rounded-t-[28px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-[28px]">
        <span className="mx-auto -mt-1.5 mb-3 block h-1 w-10 rounded-full bg-[#123047]/15 sm:hidden" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">{isError ? "Chưa gửi xong" : "Đang gửi đơn hàng…"}</h2>
        {!isError ? <p className="mt-0.5 text-xs text-muted-foreground">Vui lòng giữ màn hình này, đừng tắt trang.</p> : null}
        <ol className="mt-4 space-y-3">
          <Step state={orderState} label="Tạo đơn" />
          {hasPhotos ? <Step state={photoState} label={photoLabel} /> : null}
          <Step state={finishState} label="Hoàn tất" />
        </ol>
        {hasPhotos && !isError ? (
          <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#123047]/8" aria-label={`Đã tải ${phase.percent}%`}>
            <div className="progress-bar h-full rounded-full bg-gradient-to-r from-[#f49e0d] to-[#f7b23b] transition-[width] duration-300 ease-out" style={{ width: `${phase.step === "order" ? 3 : phase.percent}%` }} />
          </div>
        ) : null}
        {isError ? (
          <div className="mt-4 space-y-3">
            <p className="rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {phase.orderOnly
                ? phase.message ?? "Chưa tạo được đơn. Kiểm tra mạng rồi thử lại."
                : `Đơn đã được tạo. ${phase.failed ? `${phase.failed} ảnh chưa tải lên được` : "Chưa hoàn tất"}${phase.message ? ` (${phase.message.replace(/\.$/, "")})` : ""}.`}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onRetry}
              data-ripple
              className="btn-cta flex min-h-12 w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              <RotateCcw className="size-4" /> {phase.orderOnly ? "Thử lại" : "Gửi lại ảnh lỗi"}
            </button>
            {onSendLater ? (
              <button
                type="button"
                disabled={busy}
                onClick={onSendLater}
                className="btn-soft flex min-h-12 w-full items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                <MessageCircle className="size-4" /> Giữ đơn, gửi ảnh sau qua Messenger
              </button>
            ) : null}
            <div className="flex items-center justify-between text-xs">
              <a href={messengerUrl} target="_blank" rel="noopener noreferrer" className="text-brand-blue underline">
                Nhắn shop hỗ trợ
              </a>
              <button type="button" onClick={onClose} disabled={busy} className="min-h-10 px-2 text-muted-foreground underline">
                Đóng
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
