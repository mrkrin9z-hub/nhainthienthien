import { mediaFolderParts, mediaInboxParts, mediaRootParts } from "@/domain/drive-path";
import {
  formatMediaBytes,
  MEDIA_KV_MAX_BYTES,
  MEDIA_MAX_BYTES,
  mediaMimeAllowed,
  mediaTooBig,
  type MediaEntry,
} from "@/domain/media-library";
import { shopKv, onWorkers, type KvBinding } from "@/server/bindings";
import {
  acceptDriveMediaFile,
  createDriveFolder,
  driveConnected,
  listDriveFolder,
  moveDriveItem,
  openDriveUpload,
  streamDriveFile,
  type DriveListedFile,
} from "@/server/drive";

type StaffActor = { id: string; role?: string };

type LocalMediaMeta = {
  id: string;
  name: string;
  mime: string;
  size: number;
  path: string[];
  isFolder: boolean;
  createdAt: string;
  storage: "kv" | "local";
};

const MEDIA_INDEX_KEY = "media:index";
const MEDIA_BLOB_PREFIX = "media:blob:";

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

function pathKey(path: readonly string[]): string {
  return cleanSubpath(path).join("/");
}

function samePath(a: readonly string[], b: readonly string[]): boolean {
  return pathKey(a) === pathKey(b);
}

async function readIndex(kv: KvBinding | null): Promise<LocalMediaMeta[]> {
  if (!kv) return [];
  const raw = (await kv.get(MEDIA_INDEX_KEY, "json")) as LocalMediaMeta[] | null;
  return Array.isArray(raw) ? raw : [];
}

async function writeIndex(kv: KvBinding, rows: LocalMediaMeta[]) {
  await kv.put(MEDIA_INDEX_KEY, JSON.stringify(rows));
}

async function readLocalIndex(): Promise<LocalMediaMeta[]> {
  if (onWorkers()) return [];
  const { mkdir, readFile, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "data", "media-index.json");
  try {
    return JSON.parse(await readFile(file, "utf8")) as LocalMediaMeta[];
  } catch {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "[]");
    return [];
  }
}

async function writeLocalIndex(rows: LocalMediaMeta[]) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), "data", "media-index.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(rows));
}

async function loadLocalRows(): Promise<{ kv: KvBinding | null; rows: LocalMediaMeta[]; backend: "kv" | "local" }> {
  const kv = await shopKv();
  if (kv) return { kv, rows: await readIndex(kv), backend: "kv" };
  if (onWorkers()) throw new Error("Chưa kết nối Google Drive và chưa có KV để lưu media.");
  return { kv: null, rows: await readLocalIndex(), backend: "local" };
}

async function saveLocalRows(kv: KvBinding | null, rows: LocalMediaMeta[]) {
  if (kv) await writeIndex(kv, rows);
  else await writeLocalIndex(rows);
}

function localToEntry(row: LocalMediaMeta): MediaEntry {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size,
    isFolder: row.isFolder,
    modifiedAt: row.createdAt,
    thumbnailLink: null,
  };
}

export async function mediaLibraryStatus(actor: StaffActor) {
  assertStaff(actor);
  const connected = await driveConnected();
  if (connected) {
    return {
      connected: true,
      backend: "drive" as const,
      root: mediaRootParts().join(" / "),
      inbox: mediaInboxParts().join(" / "),
      maxBytes: MEDIA_MAX_BYTES,
      maxLabel: formatMediaBytes(MEDIA_MAX_BYTES),
    };
  }
  const kv = await shopKv();
  return {
    connected: false,
    backend: kv ? ("kv" as const) : ("local" as const),
    root: "Kho web (SHOP_KV / máy)",
    inbox: "Inbox web",
    maxBytes: MEDIA_KV_MAX_BYTES,
    maxLabel: formatMediaBytes(MEDIA_KV_MAX_BYTES),
  };
}

export async function listMediaLibrary(actor: StaffActor, path: readonly string[] = []) {
  assertStaff(actor);
  const clean = cleanSubpath(path);
  if (await driveConnected()) {
    const folders = mediaFolderParts(clean);
    const listed = await listDriveFolder(folders);
    const entries = listed.files.map(toEntry).sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, "vi");
    });
    return { path: clean, folders, folderId: listed.folderId, entries, backend: "drive" as const };
  }
  const { rows } = await loadLocalRows();
  const entries = rows
    .filter((row) => samePath(row.path, clean))
    .map(localToEntry)
    .sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name, "vi");
    });
  return { path: clean, folders: mediaFolderParts(clean), folderId: null, entries, backend: "local" as const };
}

export async function createMediaFolder(actor: StaffActor, path: readonly string[], name: string) {
  assertStaff(actor);
  const cleanName = name.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanName) throw new Error("Tên thư mục trống.");
  if (await driveConnected()) {
    const folders = mediaFolderParts(cleanSubpath(path));
    return createDriveFolder(folders, cleanName);
  }
  const { kv, rows } = await loadLocalRows();
  const parent = cleanSubpath(path);
  if (rows.some((row) => row.isFolder && samePath(row.path, parent) && row.name === cleanName)) {
    throw new Error("Thư mục đã có.");
  }
  const id = crypto.randomUUID().replace(/-/g, "");
  rows.push({
    id,
    name: cleanName,
    mime: "application/vnd.folder",
    size: 0,
    path: parent,
    isFolder: true,
    createdAt: new Date().toISOString(),
    storage: kv ? "kv" : "local",
  });
  await saveLocalRows(kv, rows);
  return { id, name: cleanName };
}

export async function moveMediaItem(
  actor: StaffActor,
  input: { fileId: string; fromPath: readonly string[]; toPath: readonly string[] },
) {
  assertStaff(actor);
  if (await driveConnected()) {
    await moveDriveItem({
      fileId: input.fileId,
      fromFolders: mediaFolderParts(cleanSubpath(input.fromPath)),
      toFolders: mediaFolderParts(cleanSubpath(input.toPath)),
    });
    return { ok: true as const };
  }
  const { kv, rows } = await loadLocalRows();
  const target = rows.find((row) => row.id === input.fileId);
  if (!target || target.isFolder) throw new Error("Không tìm thấy file.");
  const dest = cleanSubpath(input.toPath);
  target.path = dest;
  await saveLocalRows(kv, rows);
  return { ok: true as const };
}

export async function prepareMediaUpload(
  actor: StaffActor | null,
  input: { fileName: string; mimeType: string; sizeBytes: number; path?: readonly string[] },
) {
  if (!mediaMimeAllowed(input.mimeType)) throw new Error("Định dạng không được hỗ trợ (ảnh, video, zip).");
  if (await driveConnected()) {
    if (mediaTooBig(input.sizeBytes)) throw new Error(`Mỗi file tối đa ${formatMediaBytes(MEDIA_MAX_BYTES)}.`);
    const folders = actor ? mediaFolderParts(cleanSubpath(input.path ?? [])) : mediaInboxParts();
    const session = await openDriveUpload({
      name: input.fileName,
      mime: input.mimeType || "application/octet-stream",
      sizeBytes: input.sizeBytes,
      folders,
    });
    return { mode: "drive" as const, ...session };
  }
  if (input.sizeBytes > MEDIA_KV_MAX_BYTES) {
    throw new Error(`Chưa nối Drive — mỗi file tối đa ${formatMediaBytes(MEDIA_KV_MAX_BYTES)}. Nối Drive để gửi file lớn.`);
  }
  return {
    mode: "server" as const,
    uploadPath: "/api/public/media-upload",
    fileName: input.fileName,
    mimeType: input.mimeType || "application/octet-stream",
    sizeBytes: input.sizeBytes,
    path: actor ? cleanSubpath(input.path ?? []) : [],
    staff: Boolean(actor),
  };
}

/** @deprecated dùng prepareMediaUpload */
export async function prepareMediaDriveUpload(
  actor: StaffActor | null,
  input: { fileName: string; mimeType: string; sizeBytes: number; path?: readonly string[] },
) {
  return prepareMediaUpload(actor, input);
}

export async function finishMediaDriveUpload(
  actor: StaffActor | null,
  input: { driveFileId: string; path?: readonly string[] },
) {
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive.");
  const folders = actor ? mediaFolderParts(cleanSubpath(input.path ?? [])) : mediaInboxParts();
  const seen = await acceptDriveMediaFile(input.driveFileId, folders);
  return { ok: true as const, size: seen.size, mime: seen.mime };
}

export async function saveLocalMediaUpload(input: {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  path?: readonly string[];
  staff?: boolean;
}) {
  if (!mediaMimeAllowed(input.mimeType)) throw new Error("Định dạng không được hỗ trợ.");
  if (input.bytes.byteLength > MEDIA_KV_MAX_BYTES) {
    throw new Error(`Mỗi file tối đa ${formatMediaBytes(MEDIA_KV_MAX_BYTES)}.`);
  }
  if (await driveConnected()) {
    throw new Error("Drive đã nối — hãy dùng upload Drive.");
  }
  const { kv, rows, backend } = await loadLocalRows();
  const id = crypto.randomUUID().replace(/-/g, "");
  const parent = cleanSubpath(input.path ?? []);
  const meta: LocalMediaMeta = {
    id,
    name: input.fileName.slice(0, 200),
    mime: input.mimeType || "application/octet-stream",
    size: input.bytes.byteLength,
    path: parent,
    isFolder: false,
    createdAt: new Date().toISOString(),
    storage: backend,
  };
  if (kv) {
    await kv.put(`${MEDIA_BLOB_PREFIX}${id}`, input.bytes);
  } else {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const absolute = path.join(process.cwd(), "data", "media", id);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, input.bytes);
  }
  rows.push(meta);
  await saveLocalRows(kv, rows);
  return { ok: true as const, id, size: meta.size, mime: meta.mime };
}

export async function streamMediaFile(
  actor: StaffActor,
  fileId: string,
): Promise<{ body: BodyInit; mime: string; name: string; size: number }> {
  assertStaff(actor);
  if (await driveConnected()) {
    return streamDriveFile(fileId);
  }
  const { kv, rows } = await loadLocalRows();
  const meta = rows.find((row) => row.id === fileId && !row.isFolder);
  if (!meta) throw new Error("Không tìm thấy file.");
  if (kv) {
    const buf = await kv.get(`${MEDIA_BLOB_PREFIX}${fileId}`, "arrayBuffer");
    if (!buf) throw new Error("File không còn trên KV.");
    return {
      name: meta.name,
      mime: meta.mime,
      size: meta.size,
      body: buf,
    };
  }
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const bytes = await readFile(path.join(process.cwd(), "data", "media", fileId));
  return { name: meta.name, mime: meta.mime, size: bytes.byteLength, body: new Uint8Array(bytes) };
}
