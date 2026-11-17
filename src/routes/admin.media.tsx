import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FolderPlus, Loader2, UploadCloud } from "lucide-react";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatMediaBytes,
  MEDIA_MAX_BYTES,
  MEDIA_UPLOAD_PATH,
  mediaKindLabel,
  mediaMimeAllowed,
  type MediaEntry,
} from "@/domain/media-library";
import {
  createMediaFolder,
  finishStaffMediaUpload,
  getMediaLibraryStatus,
  listMediaLibrary,
  moveMediaItem,
  prepareStaffMediaUpload,
} from "@/lib/admin.functions";
import { putDriveFile } from "@/lib/drive-put";

export const Route = createFileRoute("/admin/media")({
  component: () => (
    <RoleGate allow={["owner", "sale", "production"]}>
      <MediaLibraryPage />
    </RoleGate>
  ),
});

type Library = {
  path: string[];
  entries: MediaEntry[];
};

function MediaLibraryPage() {
  const [status, setStatus] = useState<{ connected: boolean; root: string; inbox: string; maxLabel: string } | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [link, setLink] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<Record<string, string>>({});

  const reload = useCallback(async (nextPath = path) => {
    setLoading(true);
    try {
      const [meta, list] = await Promise.all([getMediaLibraryStatus(), listMediaLibrary({ data: { path: nextPath } })]);
      setStatus(meta);
      setLibrary({ path: list.path, entries: list.entries });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tải được MEDIA.");
      setLibrary(null);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload(path);
  }, [path, reload]);

  useEffect(() => {
    const href = typeof window !== "undefined" ? `${window.location.origin}${MEDIA_UPLOAD_PATH}` : MEDIA_UPLOAD_PATH;
    setLink(href);
    let cancel = false;
    void import("qrcode").then((QR) => {
      void QR.toDataURL(href, { width: 280, margin: 1, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancel) setQr(url);
      });
    });
    return () => {
      cancel = true;
    };
  }, []);

  const foldersHere = useMemo(() => library?.entries.filter((item) => item.isFolder) ?? [], [library]);

  async function makeFolder() {
    const name = folderName.trim();
    if (!name) {
      toast.error("Nhập tên thư mục.");
      return;
    }
    setBusy(true);
    try {
      await createMediaFolder({ data: { path, name } });
      setFolderName("");
      toast.success(`Đã tạo “${name}”`);
      await reload(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được thư mục.");
    } finally {
      setBusy(false);
    }
  }

  async function moveTo(fileId: string, folderNameTarget: string) {
    const target = folderNameTarget.trim();
    if (!target) {
      toast.error("Chọn thư mục đích.");
      return;
    }
    setBusy(true);
    try {
      await moveMediaItem({ data: { fileId, fromPath: path, toPath: [...path, target] } });
      toast.success("Đã chuyển file.");
      setMoveTarget((current) => {
        const next = { ...current };
        delete next[fileId];
        return next;
      });
      await reload(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không chuyển được.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(list: FileList | null) {
    if (!list?.length) return;
    if (!status?.connected) {
      toast.error("Chưa kết nối Google Drive.");
      return;
    }
    setBusy(true);
    let ok = 0;
    try {
      for (const file of list) {
        const mime = file.type || "application/octet-stream";
        if (!mediaMimeAllowed(mime)) {
          toast.error(`${file.name}: định dạng không hỗ trợ`);
          continue;
        }
        if (file.size > MEDIA_MAX_BYTES) {
          toast.error(`${file.name}: quá ${formatMediaBytes(MEDIA_MAX_BYTES)}`);
          continue;
        }
        try {
          const session = await prepareStaffMediaUpload({
            data: { fileName: file.name, mimeType: mime, sizeBytes: file.size, path },
          });
          const driveFileId = await putDriveFile(session.uploadUrl, file, mime);
          await finishStaffMediaUpload({ data: { driveFileId, path } });
          ok += 1;
        } catch (error) {
          toast.error(error instanceof Error ? `${file.name}: ${error.message}` : `${file.name}: lỗi`);
        }
      }
      if (ok) {
        toast.success(`Đã tải ${ok} file`);
        await reload(path);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Data / MEDIA</h1>
        <p className="text-sm text-muted-foreground">
          Lưu trên Drive: <span className="font-semibold">{status?.root ?? "NHÀ IN THIÊN THIÊN / MEDIA"}</span>. QR gửi vào Inbox; nhân viên
          tự tạo thư mục, chuyển file và tải về.
        </p>
      </div>

      {status && !status.connected ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          Chưa kết nối Google Drive.{" "}
          <Link to="/admin/ket-noi" className="font-semibold text-primary underline">
            Kết nối Drive
          </Link>{" "}
          rồi dùng trang này.
        </section>
      ) : null}

      <section className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4">
        {qr ? (
          <img src={qr} alt="Mã QR gửi media" width={140} height={140} className="h-35 w-35 rounded-md border bg-white p-1" />
        ) : (
          <div className="grid h-35 w-35 place-items-center rounded-md border text-xs text-muted-foreground">Đang tạo mã…</div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="font-semibold text-primary">QR / link gửi source</h2>
          <p className="text-xs text-muted-foreground">File mới vào {status?.inbox ?? "… / Inbox"}. Tối đa {status?.maxLabel ?? formatMediaBytes(MEDIA_MAX_BYTES)} / file.</p>
          <p className="break-all font-mono text-sm font-semibold text-primary">{link || MEDIA_UPLOAD_PATH}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => {
                void navigator.clipboard.writeText(link || MEDIA_UPLOAD_PATH).then(
                  () => toast.success("Đã chép link"),
                  () => toast.error("Không chép được"),
                );
              }}
            >
              Chép link
            </Button>
            <Button type="button" variant="outline" className="min-h-10" asChild>
              <a href={link || MEDIA_UPLOAD_PATH} target="_blank" rel="noreferrer">
                Mở trang gửi
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setPath([])}>
            MEDIA
          </button>
          {path.map((part, index) => (
            <span key={`${part}-${index}`} className="flex items-center gap-2">
              <span className="text-muted-foreground">/</span>
              <button
                type="button"
                className="font-semibold text-primary underline-offset-2 hover:underline"
                onClick={() => setPath(path.slice(0, index + 1))}
              >
                {part}
              </button>
            </span>
          ))}
          {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            className="min-h-11 max-w-xs"
            placeholder="Tên thư mục mới"
            value={folderName}
            disabled={busy || !status?.connected}
            onChange={(event) => setFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void makeFolder();
            }}
          />
          <Button type="button" className="min-h-11" disabled={busy || !status?.connected} onClick={() => void makeFolder()}>
            <FolderPlus className="mr-1 size-4" /> Tạo thư mục
          </Button>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-semibold">
            <UploadCloud className="size-4" />
            Tải lên thư mục này
            <input
              type="file"
              accept="image/*,video/*,.zip,.rar"
              multiple
              className="hidden"
              disabled={busy || !status?.connected}
              onChange={(event) => {
                void uploadFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {path[0] !== "Inbox" ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setPath(["Inbox"])}>
              Vào Inbox
            </Button>
          ) : null}
        </div>

        {!loading && library ? (
          library.entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Thư mục trống.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {library.entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    {entry.isFolder ? (
                      <button
                        type="button"
                        className="truncate text-left font-semibold text-primary underline-offset-2 hover:underline"
                        onClick={() => setPath([...path, entry.name])}
                      >
                        📁 {entry.name}
                      </button>
                    ) : (
                      <p className="truncate font-medium">{entry.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {mediaKindLabel(entry)}
                      {entry.isFolder ? "" : ` · ${formatMediaBytes(entry.size)}`}
                      {entry.modifiedAt ? ` · ${new Date(entry.modifiedAt).toLocaleString("vi-VN")}` : ""}
                    </p>
                  </div>
                  {!entry.isFolder ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {foldersHere.length ? (
                        <>
                          <select
                            className="min-h-10 rounded-md border bg-background px-2 text-sm"
                            value={moveTarget[entry.id] ?? ""}
                            disabled={busy}
                            onChange={(event) => setMoveTarget((current) => ({ ...current, [entry.id]: event.target.value }))}
                          >
                            <option value="">Chuyển vào…</option>
                            {foldersHere.map((folder) => (
                              <option key={folder.id} value={folder.name}>
                                {folder.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-10"
                            disabled={busy || !moveTarget[entry.id]}
                            onClick={() => void moveTo(entry.id, moveTarget[entry.id] ?? "")}
                          >
                            Chuyển
                          </Button>
                        </>
                      ) : null}
                      <Button type="button" variant="outline" className="min-h-10" asChild>
                        <a href={`/api/admin/media/download?id=${encodeURIComponent(entry.id)}`}>
                          <Download className="mr-1 size-4" /> Tải
                        </a>
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </section>
    </div>
  );
}
