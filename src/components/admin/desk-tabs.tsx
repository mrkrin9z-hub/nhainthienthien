import { Link, useRouterState } from "@tanstack/react-router";

import type { Role } from "@/domain/types";

type Tab = { key: string; to: string; label: string; search?: Record<string, string>; active: boolean };

function onPath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function tabsFor(pathname: string, search: Record<string, unknown>, role: Role): Tab[] {
  const panel = typeof search.m === "string" ? search.m : "";
  if (["/admin/viec", "/admin/cham-cong", "/admin/check-cong", "/admin/luong", "/admin/thuong"].some((path) => onPath(pathname, path))) {
    const items = [
      { key: "viec", to: "/admin/viec", label: "Việc" },
      { key: "cong", to: "/admin/cham-cong", label: "Chấm công" },
      { key: "check", to: "/admin/check-cong", label: "Check công" },
      { key: "luong", to: "/admin/luong", label: "Lương" },
      ...(role === "production" ? [] : [{ key: "thuong", to: "/admin/thuong", label: "Thưởng" }]),
    ];
    return items.map((item) => ({ ...item, active: onPath(pathname, item.to) }));
  }
  if (onPath(pathname, "/admin/kho")) {
    const stock = [
      { key: "ton", to: "/admin/kho", label: "Tồn", search: { m: "ton" }, active: panel === "ton" },
      ...(role === "production" ? [] : [{ key: "nhap", to: "/admin/kho", label: "Nhập", search: { m: "nhap" }, active: panel === "nhap" }]),
      { key: "hong", to: "/admin/kho", label: "Báo hỏng", search: { m: "hong" }, active: panel === "hong" },
    ];
    return stock;
  }
  if (role === "owner" && ["/admin/cai-dat", "/admin/nhan-vien", "/admin/nhom-quyen", "/admin/ket-noi"].some((path) => onPath(pathname, path))) {
    return [
      { key: "ch", to: "/admin/cai-dat", label: "Cửa hàng", search: { m: "cua-hang" }, active: onPath(pathname, "/admin/cai-dat") && panel === "cua-hang" },
      { key: "von", to: "/admin/cai-dat", label: "Giá vốn", search: { m: "chi-phi" }, active: onPath(pathname, "/admin/cai-dat") && panel === "chi-phi" },
      { key: "kenh", to: "/admin/cai-dat", label: "Kênh", search: { m: "kenh" }, active: onPath(pathname, "/admin/cai-dat") && panel === "kenh" },
      { key: "nv", to: "/admin/nhan-vien", label: "Nhân viên", active: onPath(pathname, "/admin/nhan-vien") },
      { key: "quyen", to: "/admin/nhom-quyen", label: "Nhóm quyền", active: onPath(pathname, "/admin/nhom-quyen") },
      { key: "kn", to: "/admin/ket-noi", label: "Kết nối", active: onPath(pathname, "/admin/ket-noi") },
    ];
  }
  if (["/admin/thu", "/admin/chuyen-nop", "/admin/chi-phi", "/admin/duyet-chi", "/admin/cong-no"].some((path) => pathname === path)) {
    const money = [
      { key: "thu", to: "/admin/thu", label: "Thu" },
      { key: "nop", to: "/admin/chuyen-nop", label: "Chuyển nộp" },
      { key: "chi", to: "/admin/chi-phi", label: "Chi" },
      ...(role === "owner" ? [{ key: "duyet", to: "/admin/duyet-chi", label: "Duyệt chi" }] : []),
      { key: "no", to: "/admin/cong-no", label: "Công nợ" },
    ];
    return money.map((item) => ({ ...item, active: pathname === item.to }));
  }
  if (role === "owner" && (pathname === "/admin/bao-cao" || pathname === "/admin/bao-cao-chi" || pathname === "/admin/loi-nhuan")) {
    return [
      { key: "bc", to: "/admin/bao-cao", label: "Báo cáo", active: pathname === "/admin/bao-cao" },
      { key: "cp", to: "/admin/bao-cao-chi", label: "Chi phí", active: pathname === "/admin/bao-cao-chi" },
      { key: "ln", to: "/admin/loi-nhuan", label: "Lợi nhuận", active: pathname === "/admin/loi-nhuan" },
    ];
  }
  return [];
}

export function DeskTabs({ role }: { role: Role }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const tabs = tabsFor(pathname, search, role);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Mục trong trang" className="mb-3 flex gap-1 overflow-x-auto scrollbar-none">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          {...(tab.search ? { search: tab.search as never } : {})}
          aria-current={tab.active ? "page" : undefined}
          className={`inline-flex h-8 shrink-0 items-center rounded-md px-3 text-[13px] font-semibold ${tab.active ? "bg-[#2563eb] text-white" : "bg-white text-muted-foreground hover:text-foreground"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
