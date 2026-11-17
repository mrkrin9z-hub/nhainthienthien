import { googleThumbSize } from "@/domain/order-upload";
import { readIntegrationSecret } from "@/server/secrets";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";

type DriveCreds = { clientId: string; clientSecret: string; refreshToken: string };

export async function driveConnected(): Promise<boolean> {
  return (await driveCreds()) !== null;
}

async function driveCreds(): Promise<DriveCreds | null> {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim() || (await readIntegrationSecret("google_client_id")).trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim() || (await readIntegrationSecret("google_client_secret")).trim();
  const refreshToken = (await readIntegrationSecret("google_drive")).trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export async function exchangeDriveCode(input: { code: string; redirectUri: string }): Promise<string> {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim() || (await readIntegrationSecret("google_client_id")).trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim() || (await readIntegrationSecret("google_client_secret")).trim();
  if (!clientId || !clientSecret) throw new Error("Chưa có Client ID hoặc Client secret.");
  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google từ chối mã kết nối (${res.status}).`);
  const json = (await res.json()) as { refresh_token?: string };
  if (!json.refresh_token) throw new Error("Google không trả mã làm mới. Bấm Kết nối Google Drive và đồng ý quyền.");
  return json.refresh_token;
}

async function accessToken(): Promise<string> {
  const creds = await driveCreds();
  if (!creds) throw new Error("Chưa kết nối Google Drive.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: creds.refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google Drive từ chối đăng nhập (${res.status}).`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google Drive không trả token.");
  return json.access_token;
}

function escapeQuery(name: string): string {
  return name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(token: string, name: string, parentId: string): Promise<string | null> {
  const q = `name = '${escapeQuery(name)}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;
  const url = `${FILES_URL}?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&spaces=drive`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Không tìm thư mục trên Drive (${res.status}).`);
  const json = (await res.json()) as { files?: { id?: string }[] };
  return json.files?.[0]?.id ?? null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch(`${FILES_URL}?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`Không tạo thư mục trên Drive (${res.status}).`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Drive không trả mã thư mục.");
  return json.id;
}

let folderChain: Promise<unknown> = Promise.resolve();

function oneFolderAtATime<T>(run: () => Promise<T>): Promise<T> {
  const next = folderChain.then(run, run);
  folderChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function ensureFolder(token: string, name: string, parentId: string): Promise<string> {
  return (await findFolder(token, name, parentId)) ?? createFolder(token, name, parentId);
}

const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

async function folderFor(folders: readonly string[]): Promise<{ token: string; folderId: string }> {
  return oneFolderAtATime(async () => {
    const token = await accessToken();
    let parent = "root";
    for (const part of folders) parent = await ensureFolder(token, part, parent);
    return { token, folderId: parent };
  });
}

/** Phiên tải thẳng từ máy khách lên Drive. Máy chủ không giữ byte của ảnh. */
export async function openDriveUpload(input: {
  name: string;
  mime: string;
  sizeBytes: number;
  folders: readonly string[];
}): Promise<{ uploadUrl: string }> {
  const { token, folderId } = await folderFor(input.folders);
  const safeName = input.name.replace(/[\\/]/g, "-").slice(-120) || "anh.jpg";
  const res = await fetch(`${UPLOAD_URL}?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": input.mime || "application/octet-stream",
      "X-Upload-Content-Length": String(input.sizeBytes),
    },
    body: JSON.stringify({ name: safeName, parents: [folderId] }),
  });
  if (!res.ok) throw new Error(`Không mở phiên tải Drive (${res.status}).`);
  const uploadUrl = res.headers.get("Location");
  if (!uploadUrl?.startsWith("https://")) throw new Error("Drive không trả đường dẫn tải.");
  return { uploadUrl };
}

export async function inspectDriveUpload(
  fileId: string,
  folders: readonly string[],
): Promise<{ size: number; mime: string; inFolder: boolean; head: Uint8Array }> {
  const { token, folderId } = await folderFor(folders);
  const metaRes = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}?fields=id,size,mimeType,parents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Không thấy ảnh trên Drive (${metaRes.status}).`);
  const meta = (await metaRes.json()) as { size?: string; mimeType?: string; parents?: string[] };
  const headRes = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}`, Range: "bytes=0-31" },
  });
  if (!headRes.ok && headRes.status !== 206) throw new Error(`Không đọc được đầu ảnh (${headRes.status}).`);
  const length = Number(headRes.headers.get("content-length") || 0);
  if (headRes.status === 200 && length > 64) {
    await headRes.body?.cancel();
    throw new Error("Không đọc được đầu ảnh.");
  }
  const head = new Uint8Array(await headRes.arrayBuffer()).subarray(0, 32);
  return {
    size: Number(meta.size || 0),
    mime: meta.mimeType || "",
    inFolder: (meta.parents ?? []).includes(folderId),
    head,
  };
}

export async function uploadToDrive(input: {
  name: string;
  mime: string;
  bytes: Uint8Array;
  folders: readonly string[];
}): Promise<string> {
  return oneFolderAtATime(async () => {
    const token = await accessToken();
    let parent = "root";
    for (const part of input.folders) parent = await ensureFolder(token, part, parent);
    const safeName = input.name.replace(/[\\/]/g, "-").slice(-120) || "anh.jpg";
    const boundary = `tt${crypto.randomUUID().replace(/-/g, "")}`;
    const meta = JSON.stringify({ name: safeName, parents: [parent] });
    const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${input.mime || "application/octet-stream"}\r\n\r\n`;
    const tail = `\r\n--${boundary}--`;
    const payload = Buffer.concat([Buffer.from(head), Buffer.from(input.bytes), Buffer.from(tail)]);
    const res = await fetch(`${FILES_URL}?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: payload,
    });
    if (!res.ok) throw new Error(`Không tải ảnh lên Drive (${res.status}).`);
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("Drive không trả mã file.");
    return json.id;
  });
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const token = await accessToken();
  const res = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Không xóa được ảnh trên Drive (${res.status}).`);
}

/** Ảnh nhỏ Google tạo sẵn. Không tải file gốc. */
export async function downloadDriveThumbnail(fileId: string, width: 480 | 1600): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(fileId)) throw new Error("Mã ảnh trên Drive không đúng.");
  const token = await accessToken();
  const metaRes = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}?fields=thumbnailLink`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Không lấy được ảnh nhỏ từ Google (${metaRes.status}).`);
  const meta = (await metaRes.json()) as { thumbnailLink?: string };
  const link = googleThumbSize(meta.thumbnailLink ?? "", width);
  if (!link) throw new Error("Google chưa có ảnh nhỏ.");
  let res = await fetch(link, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) res = await fetch(link);
  if (!res.ok) throw new Error(`Google không trả ảnh nhỏ (${res.status}).`);
  const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0]?.trim() || "image/jpeg";
  if (!mime.startsWith("image/")) throw new Error("Google không trả ảnh.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 1 || bytes.byteLength > 2_000_000) throw new Error("Ảnh nhỏ không dùng được.");
  return { bytes, mime };
}

export async function downloadFromDrive(fileId: string): Promise<Uint8Array> {
  const token = await accessToken();
  const res = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Không tải được ảnh từ Drive (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}

export type DriveListedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string | null;
  thumbnailLink: string | null;
};

/** Liệt kê con trực tiếp trong chuỗi thư mục (tạo thư mục nếu chưa có). */
export async function listDriveFolder(folders: readonly string[]): Promise<{
  folderId: string;
  files: DriveListedFile[];
}> {
  const { token, folderId } = await folderFor(folders);
  const q = `'${folderId}' in parents and trashed = false`;
  const fields = "files(id,name,mimeType,size,modifiedTime,thumbnailLink),nextPageToken";
  const files: DriveListedFile[] = [];
  let pageToken = "";
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(FILES_URL);
    url.searchParams.set("q", q);
    url.searchParams.set("spaces", "drive");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("fields", fields);
    url.searchParams.set("orderBy", "folder,name");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Không đọc thư mục Drive (${res.status}).`);
    const json = (await res.json()) as {
      files?: { id?: string; name?: string; mimeType?: string; size?: string; modifiedTime?: string; thumbnailLink?: string }[];
      nextPageToken?: string;
    };
    for (const file of json.files ?? []) {
      if (!file.id || !file.name) continue;
      files.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType || "application/octet-stream",
        size: Number(file.size || 0),
        modifiedTime: file.modifiedTime ?? null,
        thumbnailLink: file.thumbnailLink ?? null,
      });
    }
    pageToken = json.nextPageToken || "";
    if (!pageToken) break;
  }
  return { folderId, files };
}

export async function createDriveFolder(folders: readonly string[], name: string): Promise<{ id: string; name: string }> {
  const clean = name.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!clean) throw new Error("Nhập tên thư mục.");
  return oneFolderAtATime(async () => {
    const token = await accessToken();
    let parent = "root";
    for (const part of folders) parent = await ensureFolder(token, part, parent);
    const existing = await findFolder(token, clean, parent);
    if (existing) return { id: existing, name: clean };
    const id = await createFolder(token, clean, parent);
    return { id, name: clean };
  });
}

/** Chuyển file/thư mục vào thư mục đích (cùng cây MEDIA). */
export async function moveDriveItem(input: {
  fileId: string;
  fromFolders: readonly string[];
  toFolders: readonly string[];
}): Promise<void> {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(input.fileId)) throw new Error("Mã file Drive không đúng.");
  const from = await folderFor(input.fromFolders);
  const to = await folderFor(input.toFolders);
  if (from.folderId === to.folderId) return;
  const token = from.token;
  const metaRes = await fetch(`${FILES_URL}/${encodeURIComponent(input.fileId)}?fields=id,parents`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Không thấy file trên Drive (${metaRes.status}).`);
  const meta = (await metaRes.json()) as { parents?: string[] };
  const parents = meta.parents ?? [];
  if (!parents.includes(from.folderId)) throw new Error("File không nằm trong thư mục hiện tại.");
  const url = `${FILES_URL}/${encodeURIComponent(input.fileId)}?addParents=${encodeURIComponent(to.folderId)}&removeParents=${encodeURIComponent(from.folderId)}&fields=id`;
  const res = await fetch(url, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Không chuyển được file (${res.status}).`);
}

export async function streamDriveFile(fileId: string): Promise<{ body: ReadableStream<Uint8Array>; mime: string; name: string; size: number }> {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(fileId)) throw new Error("Mã file Drive không đúng.");
  const token = await accessToken();
  const metaRes = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Không thấy file trên Drive (${metaRes.status}).`);
  const meta = (await metaRes.json()) as { name?: string; mimeType?: string; size?: string };
  if ((meta.mimeType || "").includes("folder")) throw new Error("Không tải thư mục.");
  const res = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) throw new Error(`Không tải được file từ Drive (${res.status}).`);
  return {
    body: res.body,
    mime: meta.mimeType || "application/octet-stream",
    name: meta.name || "file",
    size: Number(meta.size || 0),
  };
}

/** Xác nhận file nằm đúng thư mục đích (không bắt buộc ảnh). */
export async function acceptDriveMediaFile(driveFileId: string, folders: readonly string[]): Promise<{ size: number; mime: string }> {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(driveFileId)) throw new Error("Mã file Drive không đúng.");
  const seen = await inspectDriveUpload(driveFileId, folders);
  if (!seen.inFolder || seen.size < 1) {
    await deleteFromDrive(driveFileId).catch(() => undefined);
    throw new Error("File không nằm đúng thư mục MEDIA.");
  }
  return { size: seen.size, mime: seen.mime };
}
