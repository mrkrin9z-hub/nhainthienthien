/** Trang nội bộ (admin, tạo đơn, việc nhân viên, đăng nhập) — không hiện chrome khách như nút Zalo. */
const STAFF_PREFIXES = ["/admin", "/orders", "/q", "/q_"];

export function normalizePathname(pathname: string): string {
  const path = (pathname.split("?")[0] ?? "/").trim() || "/";
  if (path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

export function isStaffPath(pathname: string): boolean {
  const path = normalizePathname(pathname).toLowerCase();
  for (const prefix of STAFF_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}

export function isPublicSitePath(pathname: string): boolean {
  return !isStaffPath(pathname);
}
