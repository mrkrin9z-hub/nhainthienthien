import { mediaFolderParts, mediaInboxParts, mediaRootParts } from "@/domain/drive-path";
import {
  formatMediaBytes,
  MEDIA_MAX_BYTES,
  mediaMimeAllowed,
  mediaTooBig,
  type MediaEntry,
} from "@/domain/media-library";
import {
  acceptDriveMediaFile,
  createDriveFolder,
  driveConnected,
  listDriveFolder,
  moveDriveItem,
  openDriveUpload,
  type DriveListedFile,
} from "@/server/drive";
type StaffActor = { id: string; role?: string };

function assertStaff(actor: StaffActor | null | undefined) {
  if (!actor?.id) throw new Error("Chưa đăng nhập.");
}

function toEntry(file: DriveListedFile): MediaEntry {
  const isFolder = file.mimeType === "application/vnd.google-apps.folder";
  return {
    id: file.id,
    name: file.name,
    mime: file.mimeType,
    size: isFolder ? 0 : file.size,
    isFolder,
    modifiedAt: file.modifiedTime,
    thumbnailLink: file.thumbnailLink,
  };
}

function cleanSubpath(path: readonly string[]): string[] {
  return path
    .map((part) => part.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((part) => part !== "." && part !== "..")
    .slice(0, 8);
}

export async function mediaLibraryStatus(actor: StaffActor) {
  assertStaff(actor);
  const connected = await driveConnected();
  return {
    connected,
    root: mediaRootParts().join(" / "),
    inbox: mediaInboxParts().join(" / "),
    maxBytes: MEDIA_MAX_BYTES,
    maxLabel: formatMediaBytes(MEDIA_MAX_BYTES),
  };
}

export async function listMediaLibrary(actor: StaffActor, path: readonly string[] = []) {
  assertStaff(actor);
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive. Vào Cài đặt → Kết nối.");
  const folders = mediaFolderParts(cleanSubpath(path));
  const listed = await listDriveFolder(folders);
  const entries = listed.files.map(toEntry).sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name, "vi");
  });
  return {
    path: cleanSubpath(path),
    folders,
    folderId: listed.folderId,
    entries,
  };
}

export async function createMediaFolder(actor: StaffActor, path: readonly string[], name: string) {
  assertStaff(actor);
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive.");
  const folders = mediaFolderParts(cleanSubpath(path));
  return createDriveFolder(folders, name);
}

export async function moveMediaItem(
  actor: StaffActor,
  input: { fileId: string; fromPath: readonly string[]; toPath: readonly string[] },
) {
  assertStaff(actor);
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive.");
  await moveDriveItem({
    fileId: input.fileId,
    fromFolders: mediaFolderParts(cleanSubpath(input.fromPath)),
    toFolders: mediaFolderParts(cleanSubpath(input.toPath)),
  });
  return { ok: true as const };
}

export async function prepareMediaDriveUpload(
  actor: StaffActor | null,
  input: { fileName: string; mimeType: string; sizeBytes: number; path?: readonly string[] },
) {
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive. Chủ tiệm cần kết nối Drive trước.");
  if (!mediaMimeAllowed(input.mimeType)) throw new Error("Định dạng không được hỗ trợ (ảnh, video, zip).");
  if (mediaTooBig(input.sizeBytes)) throw new Error(`Mỗi file tối đa ${formatMediaBytes(MEDIA_MAX_BYTES)}.`);
  const folders = actor
    ? mediaFolderParts(cleanSubpath(input.path ?? []))
    : mediaInboxParts();
  return openDriveUpload({
    name: input.fileName,
    mime: input.mimeType || "application/octet-stream",
    sizeBytes: input.sizeBytes,
    folders,
  });
}

export async function finishMediaDriveUpload(
  actor: StaffActor | null,
  input: { driveFileId: string; path?: readonly string[] },
) {
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive.");
  const folders = actor
    ? mediaFolderParts(cleanSubpath(input.path ?? []))
    : mediaInboxParts();
  const seen = await acceptDriveMediaFile(input.driveFileId, folders);
  return { ok: true as const, size: seen.size, mime: seen.mime };
}
