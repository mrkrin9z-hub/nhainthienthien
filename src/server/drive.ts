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

export async function downloadFromDrive(fileId: string): Promise<Uint8Array> {
  const token = await accessToken();
  const res = await fetch(`${FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Không tải được ảnh từ Drive (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
