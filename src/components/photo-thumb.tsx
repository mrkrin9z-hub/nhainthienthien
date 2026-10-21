import { useEffect, useState } from "react";

import { imagePreviewable } from "@/domain/images";
import { zipStored } from "@/domain/zip-store";

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

export function staffDownload(id: string): string {
  return `/api/staff/file/${encodeURIComponent(id)}?dl=1`;
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name || "tep";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Một file lưu thẳng vào máy, không mở tab mới. */
export async function saveStaffFile(id: string, name: string): Promise<void> {
  const response = await fetch(staffDownload(id), { credentials: "same-origin" });
  if (!response.ok) throw new Error("Không tải được file.");
  saveBlob(await response.blob(), name);
}

/** Nhiều file gom một zip rồi lưu một lần. */
export async function saveStaffFiles(files: { id: string; name: string }[], archiveName: string): Promise<void> {
  if (files.length === 0) throw new Error("Chưa có file.");
  if (files.length === 1) {
    const only = files[0];
    if (!only) return;
    await saveStaffFile(only.id, only.name);
    return;
  }
  const packed: { name: string; bytes: Uint8Array }[] = [];
  for (const file of files) {
    const response = await fetch(staffDownload(file.id), { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Không tải được ${file.name}.`);
    packed.push({ name: file.name, bytes: new Uint8Array(await response.arrayBuffer()) });
  }
  saveBlob(zipStored(packed), archiveName);
}

export function PhotoViewer({
  src,
  name,
  onClose,
  downloadHref,
  downloadName,
}: {
  src: string;
  name: string;
  onClose: () => void;
  downloadHref?: string;
  downloadName?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileId = downloadHref?.split("/").pop()?.split("?")[0] ?? "";
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
          <button
            type="button"
            className="text-sm font-semibold text-white underline disabled:opacity-60"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setError("");
              void saveStaffFile(decodeURIComponent(fileId), downloadName || name)
                .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Không tải được file."))
                .finally(() => setSaving(false));
            }}
          >
            {saving ? "Đang tải…" : "Tải về máy"}
          </button>
        ) : null}
        {error ? <p className="text-sm text-red-200">{error}</p> : null}
      </div>
    </div>
  );
}
