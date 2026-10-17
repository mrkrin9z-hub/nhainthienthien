/** Sai 8 lần trong 15 phút thì khóa email đó. */
export const LOGIN_FAIL_LIMIT = 8;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;
export const LOGIN_FAIL_TTL_SECONDS = LOGIN_LOCK_MS / 1000;

export function loginFailKey(email: string): string {
  return `login_fail:${email.trim().toLowerCase()}`;
}

export function loginLocked(fails: { at: string }[], now: number): boolean {
  const windowStart = now - LOGIN_LOCK_MS;
  const recent = fails.filter((row) => {
    const at = Date.parse(row.at);
    return Number.isFinite(at) && at >= windowStart && at <= now;
  });
  return recent.length >= LOGIN_FAIL_LIMIT;
}
