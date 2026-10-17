function driveEnv() {
  const email = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!email || !key || !folderId) return null;
  return { email, key, folderId };
}

export function driveConfigured(): boolean {
  return driveEnv() !== null;
}

function bytesOfPem(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const buf = Buffer.from(body, "base64");
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

function b64url(input: Buffer | Uint8Array | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : Buffer.from(input);
  return buf.toString("base64url");
}

async function accessToken(): Promise<string> {
  const env = driveEnv();
  if (!env) throw new Error("Chưa cấu hình Google Drive.");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: env.email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    bytesOfPem(env.key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
  const jwt = `${header}.${claim}.${b64url(new Uint8Array(sig))}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google Drive từ chối đăng nhập (${res.status}).`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Google Drive không trả token.");
  return json.access_token;
}

export async function uploadToDrive(name: string, mime: string, bytes: Uint8Array): Promise<string> {
  const env = driveEnv();
  if (!env) throw new Error("Chưa cấu hình Google Drive.");
  const token = await accessToken();
  const boundary = `tt${crypto.randomUUID().replace(/-/g, "")}`;
  const meta = JSON.stringify({ name, parents: [env.folderId] });
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const payload = Buffer.concat([Buffer.from(head), Buffer.from(bytes), Buffer.from(tail)]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
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
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Không xóa được ảnh trên Drive (${res.status}).`);
}

export async function downloadFromDrive(fileId: string): Promise<Uint8Array> {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Không tải được ảnh từ Drive (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
