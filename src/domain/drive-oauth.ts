const STATE_MS = 10 * 60 * 1000;
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlToString(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const bin = atob(value.replaceAll("-", "+").replaceAll("_", "/") + pad);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToB64url(new Uint8Array(sig));
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** State OAuth gắn với nhân viên, hết hạn sau 10 phút. Không chứa khóa. */
export async function signDriveState(staffId: string, secret: string, now = Date.now()): Promise<string> {
  const payload = `${staffId}|${now + STATE_MS}`;
  return `${bytesToB64url(new TextEncoder().encode(payload))}.${await hmac(secret, payload)}`;
}

export async function readDriveState(state: string, secret: string, now = Date.now()): Promise<string | null> {
  const dot = state.lastIndexOf(".");
  if (dot < 1) return null;
  let payload = "";
  try {
    payload = b64urlToString(state.slice(0, dot));
  } catch {
    return null;
  }
  const sig = state.slice(dot + 1);
  if (!sameText(sig, await hmac(secret, payload))) return null;
  const sep = payload.lastIndexOf("|");
  if (sep < 1) return null;
  const staffId = payload.slice(0, sep);
  const exp = Number(payload.slice(sep + 1));
  if (!staffId || !Number.isFinite(exp) || exp < now) return null;
  return staffId;
}

export function googleAuthUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
