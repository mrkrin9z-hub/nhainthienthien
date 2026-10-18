import { useEffect, useState } from "react";

import { imagePreviewable } from "@/domain/images";

export function staffThumb(id: string, large = false): string {
  return `/api/staff/file/${encodeURIComponent(id)}?thumb=1${large ? "&view=1" : ""}`;
}

export function canPreviewPhoto(file: { name: string; mime?: string; status?: string; kind?: string }): boolean {
  if (file.kind === "packing_video") return false;
  if (file.status && file.status !== "complete") return false;
  if (file.kind === "original" || file.kind === "design" || file.kind === "approval") return true;
  return imagePreviewable(file.name, file.mime ?? "");
}

/** Ảnh vừa chọn trên máy, trước khi gửi lên tiệm. */
export function LocalPhotoThumb({ file, className }: { file: File; className?: string }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    setFailed(false);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  if (!url || failed) {
    return <span className={`grid place-items-center bg-muted text-[10px] font-semibold text-muted-foreground ${className ?? ""}`}>Ảnh</span>;
  }
  return <img src={url} alt="" className={className} onError={() => setFailed(true)} />;
}

export function PhotoViewer({
  src,
  name,
  onClose,
  downloadHref,
}: {
  src: string;
  name: string;
  onClose: () => void;
  downloadHref?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={name}>
      <button
        type="button"
        className="absolute right-4 top-4 flex h-11 items-center rounded-full bg-background px-4 text-sm font-semibold text-foreground"
        onClick={onClose}
      >
        Đóng
      </button>
      <div className="flex max-h-[90vh] max-w-full flex-col items-center gap-3">
        <img src={src} alt={name} className="max-h-[80vh] max-w-full rounded-2xl object-contain" />
        <p className="max-w-full truncate text-sm text-white">{name}</p>
        {downloadHref ? (
          <a className="text-sm font-semibold text-white underline" href={downloadHref}>
            Tải ảnh gốc
          </a>
        ) : null}
      </div>
    </div>
  );
}
