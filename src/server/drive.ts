import { googleThumbSize } from "@/domain/order-upload";
import { readIntegrationSecret } from "@/server/secrets";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";

type DriveCreds = { clientId: string; clientSecret: string; refreshToken: string };

export async function driveConnected(): Promise<boolean> {
  return (await driveCreds()) !== null;
}

async function driveCreds(): Promise<DriveCreds | null> {
  const clientId = (await readIntegrationSecret("google_client_id")).trim();
  const clientSecret = (await readIntegrationSecret("google_client_secret")).trim();
  const refreshToken = (await readIntegrationSecret("google_drive")).trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

export async function exchangeDriveCode(input: { code: string; redirectUri: string }): Promise<string> {
  const clientId = (await readIntegrationSecret("google_client_id")).trim();
  const clientSecret = (await readIntegrationSecret("google_client_secret")).trim();
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
