/** Sai 8 lần trong 15 phút thì khóa email đó. Sai 30 lần từ một IP thì khóa IP đó. */
export const LOGIN_FAIL_LIMIT = 8;
export const LOGIN_IP_FAIL_LIMIT = 30;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
export const LOGIN_FAIL_TTL_SECONDS = LOGIN_LOCK_MS / 1000;

export function loginFailKey(email: string): string {
  return `login_fail:${email.trim().toLowerCase()}`;
}

/** Bỏ ký tự điều khiển và khoảng trắng để khóa KV không bị tách dòng. */
export function loginIp(raw: string): string {
  const clean = raw.replace(/[\u0000-\u001f\s]/g, "").slice(0, 80);
  return clean || "unknown";
}

export function loginFailIpKey(ip: string): string {
  return `login_fail_ip:${loginIp(ip)}`;
}

export function loginLocked(fails: { at: string }[], now: number): boolean {
  const windowStart = now - LOGIN_LOCK_MS;
  const recent = fails.filter((row) => {
    const at = Date.parse(row.at);
    return Number.isFinite(at) && at >= windowStart && at <= now;
  });
  return recent.length >= LOGIN_FAIL_LIMIT;
}
