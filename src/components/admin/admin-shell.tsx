import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Archive,
  BarChart3,
  Bell,
  ClipboardList,
  Clock,
  FileSpreadsheet,
  HandCoins,
  Image,
  Images,
  Landmark,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Search,
  Package,
  Plug,
  Plus,
  Receipt,
  ScrollText,
  Settings,
  Tags,
  Target,
  Truck,
  UserCog,
  UserRound,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_MODULE_GROUPS, modulesForRole, type AdminModule, type AdminModuleGroup } from "@/admin-os/modules";
import { AdminLogin } from "@/components/admin/admin-login";
import { DeskTabs } from "@/components/admin/desk-tabs";
import { LOGO_HORIZONTAL } from "@/lib/assets";
import { changeOwnPassword, getMe, getNavCounts, logoutStaff } from "@/lib/admin.functions";
import { ROLE_LABEL, type Role } from "@/domain/types";

const ICONS: Record<string, typeof LayoutDashboard> = {
  "/admin": LayoutDashboard,
  "/admin/chat": MessageCircle,
  "/admin/lich": ClipboardList,
  "/admin/cong-viec": ClipboardList,
  "/admin/nhom-quyen": UserCog,
  "/admin/muc-tieu": Target,
  "/admin/sepay": Wallet,
  "/admin/thong-bao": Bell,
  "/admin/tin-mau": MessageCircle,
  "/admin/danh-gia": ScrollText,
  "/admin/goi": Archive,
  "/admin/don-hang": ClipboardList,
  "/admin/don-moi": Plus,
  "/admin/nhap-don": FileSpreadsheet,
  "/orders/create": ClipboardList,
  "/admin/san-xuat": ClipboardList,
  "/admin/giao-hang": Truck,
  "/admin/cod": Wallet,
  "/admin/nhap-don": ClipboardList,
  "/admin/khach": Users,
  "/admin/album": Images,
  "/admin/nhac-khach": Bell,
  "/admin/gia": Tags,
  "/admin/kho": Package,
  "/admin/anh": Image,
  "/admin/cham-cong": Clock,
  "/admin/viec": ClipboardList,
  "/admin/nhan-vien": UserCog,
  "/admin/luong": Receipt,
  "/admin/tai-khoan": UserRound,
  "/admin/thu": HandCoins,
  "/admin/chi-phi": Receipt,
  "/admin/vi": Landmark,
  "/admin/bao-cao-chi": BarChart3,
  "/admin/loi-nhuan": Receipt,
  "/admin/bao-cao": BarChart3,
  "/admin/kpi": Target,
  "/admin/nhat-ky": ScrollText,
  "/admin/sao-luu": Archive,
  "/admin/ket-noi": Plug,
  "/admin/cai-dat": Settings,
  "/admin/in-don": Receipt,
  "/admin/check-cong": Clock,
  "/admin/thuong": Target,
  "/admin/chuyen-nop": Landmark,
  "/admin/duyet-chi": Receipt,
  "/admin/cong-no": HandCoins,
};

function pathActive(pathname: string, to: string) {
  if (to === "/admin") return pathname === "/admin" || pathname === "/admin/";
  if (to === "/admin/don-hang") return pathname.startsWith("/admin/don-hang");
  if (to === "/admin/don-moi") return pathname.startsWith("/admin/don-moi") || pathname.startsWith("/orders/");
  if (to === "/admin/gia") return pathname.startsWith("/admin/gia") || pathname.startsWith("/admin/san-pham");
  if (to === "/admin/viec") {
    return ["/admin/viec", "/admin/cham-cong", "/admin/check-cong", "/admin/luong", "/admin/thuong"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  if (to === "/admin/cai-dat") {
    return ["/admin/cai-dat", "/admin/nhan-vien", "/admin/nhom-quyen", "/admin/ket-noi"].some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function searchMatches(item: AdminModule, search: Record<string, unknown>) {
  if (!item.search) return true;
  return Object.entries(item.search).every(([key, value]) => String(search[key] ?? "") === value);
}

function itemActive(pathname: string, search: Record<string, unknown>, item: AdminModule, items: AdminModule[]) {
  if (!pathActive(pathname, item.to) || !searchMatches(item, search)) return false;
  if (item.search) return true;
  return !items.some((other) => other !== item && other.search && pathActive(pathname, other.to) && searchMatches(other, search));
}

function pageTitle(pathname: string, role: Role, search: Record<string, unknown>): string {
  if (pathname.startsWith("/orders/create") || pathname.startsWith("/admin/don-moi")) return "Tạo đơn hàng mới";
  if (pathname.startsWith("/admin/tem/")) return "Tem đơn";
  if (pathname.startsWith("/admin/phieu/")) return "Phiếu giao nhận";
  if (pathname.startsWith("/admin/don-hang/") && pathname !== "/admin/don-hang" && pathname !== "/admin/don-hang/") return "Chi tiết đơn";
  if (pathname.startsWith("/admin/khach/") && pathname !== "/admin/khach" && pathname !== "/admin/khach/") return "Hồ sơ khách";
  if (pathname.startsWith("/admin/album/") && pathname !== "/admin/album" && pathname !== "/admin/album/") return "Album ảnh";
  const items = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).filter((item) => item.roles.includes(role));
  const match = items
    .filter((item) => itemActive(pathname, search, item, items))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (match) {
    if (match.to === "/admin/luong" && role !== "owner") return "Lương của tôi";
    return match.label;
  }
  const extra: [string, string][] = [
    ["/admin/san-pham", "Sản phẩm"],
    ["/admin/cham-cong", "Chấm công"],
    ["/admin/check-cong", "Check công"],
    ["/admin/luong", role === "owner" ? "Lương" : "Lương của tôi"],
    ["/admin/thuong", "Thưởng"],
    ["/admin/nhan-vien", "Nhân viên"],
    ["/admin/nhom-quyen", "Nhóm quyền"],
    ["/admin/ket-noi", "Kết nối"],
    ["/admin/thu", "Thu"],
    ["/admin/chuyen-nop", "Chuyển nộp"],
    ["/admin/chi-phi", "Chi"],
    ["/admin/duyet-chi", "Duyệt chi"],
    ["/admin/cong-no", "Công nợ"],
    ["/admin/bao-cao-chi", "Báo cáo chi"],
    ["/admin/bao-cao", "Báo cáo"],
    ["/admin/loi-nhuan", "Lợi nhuận"],
  ];
  const titled = extra.find(([path]) => pathname === path || pathname.startsWith(`${path}/`));
  return titled?.[1] ?? "Quản trị";
}

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("");
  return letters.toUpperCase().slice(0, 2) || "U";
}

export function AdminShell({ initialMe = undefined }: { initialMe?: Awaited<ReturnType<typeof getMe>> }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search as Record<string, unknown> });
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe(), initialData: initialMe });
  const counts = useQuery({ queryKey: ["nav-counts"], queryFn: () => getNavCounts(), enabled: Boolean(me.data) && !me.data.mustChangePassword });
  const [menuOpen, setMenuOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [find, setFind] = useState("");
  useEffect(() => {
    document.documentElement.classList.add("admin-desk");
    return () => document.documentElement.classList.remove("admin-desk");
  }, []);

  if (me.isLoading) return <div className="p-10 text-center text-muted-foreground">Đang tải…</div>;
  if (!me.data) return <AdminLogin onDone={() => queryClient.invalidateQueries({ queryKey: ["me"] })} />;

  const role = me.data.role;
  async function logout() {
    await logoutStaff();
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    toast.success("Đã đăng xuất");
    setMenuOpen(false);
    router.navigate({ to: "/admin" });
  }

  const groups = modulesForRole(role, me.data.modules);
  function goFind(event: { preventDefault: () => void }) {
    event.preventDefault();
    const value = find.trim();
    if (!value) return;
    if (/^(TT|MH)/i.test(value)) {
      void router.navigate({ to: "/admin/don-hang/$code", params: { code: value.toUpperCase() } });
    } else {
      void router.navigate({ to: "/admin/don-hang", search: { status: "all", q: value } as never });
    }
    setMenuOpen(false);
  }

  return (
    <div className="admin-desk flex min-h-screen bg-[#f3f4f7]">
      {menuOpen ? (
        <button type="button" className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside
        className={`print:hidden fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-white pt-[env(safe-area-inset-top)] transition-[width] md:sticky ${narrow ? "md:w-[4.5rem]" : "md:w-[228px]"} w-[228px] ${menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
          <span className="flex size-8 items-center justify-center rounded-xl bg-[#2563eb] text-[11px] font-bold text-white">TT</span>
          {narrow ? null : <span className="truncate text-[13px] font-bold tracking-tight text-foreground">Thiên Thiên</span>}
          <button type="button" className="ml-auto flex size-7 items-center justify-center rounded md:hidden" aria-label="Đóng" onClick={() => setMenuOpen(false)}>
            <X className="size-4" />
          </button>
        </div>
        <nav aria-label="Mục quản trị" className="flex-1 overflow-y-auto px-2 py-2">
          <DeskNav
            groups={groups}
            pathname={pathname}
            search={search}
            role={role}
            narrow={narrow}
            counts={counts.data ?? {}}
            onNavigate={() => setMenuOpen(false)}
            onExpand={() => setNarrow(false)}
          />
        </nav>
        <div className="border-t border-sidebar-border p-2">
          <button type="button" className="mb-2 hidden h-8 w-full items-center justify-center rounded-lg text-[12px] font-semibold text-muted-foreground hover:bg-muted md:flex" onClick={() => setNarrow((value) => !value)}>
            {narrow ? "Hiện" : "Ẩn"}
          </button>
          <div className="flex items-center gap-2 px-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white">
              {initials(me.data.name)}
            </span>
            {narrow ? null : (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{me.data.name}</span>
                <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[role]}</span>
              </span>
            )}
            <Button variant="ghost" size="icon" className="size-8" title="Đăng xuất" onClick={() => void logout()}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-[#e5e7eb] bg-white px-3 print:hidden md:px-5">
          <button type="button" className="flex size-8 items-center justify-center rounded md:hidden" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu className="size-4" />
          </button>
          <Link to="/admin" className="hidden shrink-0 items-center sm:flex" aria-label="Tổng quan">
            <img src={LOGO_HORIZONTAL} alt="Nhà In Thiên Thiên" className="h-8 w-auto" />
          </Link>
          <form className="relative min-w-0 flex-1" onSubmit={goFind}>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={find}
              onChange={(event) => setFind(event.target.value)}
              placeholder="Tìm đơn, tên khách, SĐT…"
              aria-label="Tìm đơn"
              className="h-9 pl-9"
            />
          </form>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex items-center gap-2 rounded-full" aria-label="Tài khoản">
                <span className="hidden text-right sm:block">
                  <span className="block text-sm font-semibold">{me.data.name}</span>
                  <span className="block text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white">{initials(me.data.name)}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{me.data.name}</DropdownMenuLabel>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{ROLE_LABEL[role]}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/admin/tai-khoan">Tài khoản</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void logout()}>Đăng xuất</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4 md:px-6 md:pb-6">
          {me.data.mustChangePassword ? (
            <ForcePasswordChange
              onDone={() => {
                void queryClient.invalidateQueries({ queryKey: ["me"] });
              }}
            />
          ) : (
            <>
              <DeskTabs role={role} />
              <Outlet />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

const GROUP_ICONS: Record<string, typeof LayoutDashboard> = {
  "Tổng quan": LayoutDashboard,
  "Đơn hàng": ClipboardList,
  "Sản xuất": ClipboardList,
  "Sản phẩm": Tags,
  "Tiền": HandCoins,
  "Thống kê báo cáo": BarChart3,
  "Thống kê khách hàng": Users,
  "Kho vật tư": Package,
  "Nhân sự": Users,
  "Cài đặt": Settings,
};

function groupTile(title: string | undefined): string {
  if (title === "Nhân sự") return "bg-[#ffedd5] text-[#ea580c]";
  if (title === "Kho vật tư") return "bg-[#ccfbf1] text-[#0f766e]";
  if (title === "Cài đặt") return "bg-[#f1f5f9] text-[#475569]";
  if (title === "Sản phẩm") return "bg-[#fef3c7] text-[#b45309]";
  if (title === "Sản xuất") return "bg-[#ede9fe] text-[#6d28d9]";
  return "bg-[#e0eefe] text-[#2563eb]";
}

function CountBadge({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#dc2626] px-1 text-[10px] font-bold text-white">
      {n > 99 ? "99+" : n}
    </span>
  );
}

function DeskNav({
  groups,
  pathname,
  search,
  role,
  narrow,
  counts,
  onNavigate,
  onExpand,
}: {
  groups: AdminModuleGroup[];
  pathname: string;
  search: Record<string, unknown>;
  role: Role;
  narrow: boolean;
  counts: Record<string, number>;
  onNavigate: () => void;
  onExpand: () => void;
}) {
  const flat = groups.flatMap((group) => group.items);
  const activeTitle = groups.find((group) => group.items.some((item) => itemActive(pathname, search, item, flat)))?.title ?? "";
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!activeTitle) return;
    setOpen((prev) => (prev[activeTitle] ? prev : { ...prev, [activeTitle]: true }));
  }, [activeTitle]);

  return (
    <>
      {groups.map((group) => {
        if (group.items.length === 1) {
          const item = group.items[0]!;
          const active = pathActive(pathname, item.to);
          const Icon = GROUP_ICONS[group.title] ?? LayoutDashboard;
          const tone = groupTile(group.title);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={`mb-0.5 flex min-h-9 items-center gap-2 rounded-xl px-1.5 text-[13px] font-semibold ${active ? "bg-[#e0eefe] text-[#1d4ed8]" : "text-sidebar-foreground hover:bg-[#f8fafc]"}`}
              onClick={onNavigate}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#2563eb] text-white" : tone}`}>
                <Icon className="size-3.5" />
              </span>
              {narrow ? null : (
                <>
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto">
                    <CountBadge n={counts[item.to] ?? 0} />
                  </span>
                </>
              )}
            </Link>
          );
        }
        const title = group.title || "Menu";
        const tone = groupTile(title);
        const GroupIcon = GROUP_ICONS[title] ?? LayoutDashboard;
        const groupCount = group.items.reduce((sum, item) => sum + (item.search ? 0 : (counts[item.to] ?? 0)), 0);
        const childActive = group.items.some((item) => itemActive(pathname, search, item, flat));
        const expanded = !narrow && open[title] === true;
        return (
          <div key={title} className="mb-1">
            <button
              type="button"
              aria-expanded={expanded}
              title={title}
              className={`flex min-h-9 w-full items-center gap-2 rounded-xl px-1.5 text-left text-[13px] font-semibold ${childActive ? "bg-[#e0eefe] text-[#1d4ed8]" : "text-sidebar-foreground hover:bg-[#f8fafc]"}`}
              onClick={() => {
                if (narrow) {
                  onExpand();
                  setOpen((prev) => ({ ...prev, [title]: true }));
                  return;
                }
                setOpen((prev) => ({ ...prev, [title]: !prev[title] }));
              }}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${childActive ? "bg-[#2563eb] text-white" : tone}`}>
                <GroupIcon className="size-3.5" />
              </span>
              {narrow ? null : (
                <>
                  <span className="truncate">{title}</span>
                  {expanded || !groupCount ? null : (
                    <span className="ml-auto">
                      <CountBadge n={groupCount} />
                    </span>
                  )}
                  <ChevronDown className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded || !groupCount ? "ml-auto" : "ml-1"} ${expanded ? "rotate-180" : ""}`} />
                </>
              )}
            </button>
            {expanded
              ? group.items.map((item) => {
                  const Icon = ICONS[item.to] ?? LayoutDashboard;
                  const active = itemActive(pathname, search, item, flat);
                  const label = item.to === "/admin/luong" && role !== "owner" ? "Lương của tôi" : item.label;
                  return (
                    <Link
                      key={`${item.to}-${item.label}`}
                      to={item.to}
                      {...(item.search ? { search: item.search as never } : {})}
                      title={label}
                      aria-current={active ? "page" : undefined}
                      className={`mb-0.5 ml-3 flex min-h-8 items-center gap-2 rounded-xl px-1.5 text-[13px] ${active ? "bg-[#e0eefe] font-semibold text-[#1d4ed8]" : "text-sidebar-foreground hover:bg-[#f8fafc]"}`}
                      onClick={onNavigate}
                    >
                      <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${active ? "bg-[#2563eb] text-white" : tone}`}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="truncate">{label}</span>
                      <span className="ml-auto">
                        <CountBadge n={item.search ? 0 : (counts[item.to] ?? 0)} />
                      </span>
                    </Link>
                  );
                })
              : null}
          </div>
        );
      })}
    </>
  );
}

function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="glass-card mx-auto max-w-md space-y-4 rounded-3xl p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
          await changeOwnPassword({ data: { current, next } });
          toast.success("Đã đổi mật khẩu");
          onDone();
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setLoading(false);
        }
      }}
    >
      <h1 className="mt-4 text-2xl font-extrabold text-primary">Đổi mật khẩu lần đầu</h1>
      <p className="text-sm text-muted-foreground">Tài khoản mẫu phải đặt mật khẩu mới trước khi xem sổ.</p>
      <div>
        <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
        <Input id="current-password" type="password" autoComplete="current-password" className="mt-1 min-h-12" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="next-password">Mật khẩu mới (ít nhất 8 ký tự)</Label>
        <Input id="next-password" type="password" autoComplete="new-password" className="mt-1 min-h-12" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
      </div>
      <Button type="submit" className="min-h-12 w-full" disabled={loading}>
        {loading ? "Đang lưu…" : "Lưu mật khẩu mới"}
      </Button>
    </form>
  );
}

