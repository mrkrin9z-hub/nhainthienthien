import { Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Archive,
  BarChart3,
  Bell,
  ClipboardList,
  Clock,
  HandCoins,
  Image,
  Images,
  Landmark,
  CalendarDays,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Plug,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_MODULE_GROUPS, modulesForRole } from "@/admin-os/modules";
import { LOGO_HORIZONTAL } from "@/lib/assets";
import { changeOwnPassword, getMe, loginStaff, logoutStaff } from "@/lib/admin.functions";
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
  "/admin/don-moi": ClipboardList,
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
};

function pathActive(pathname: string, to: string) {
  if (to === "/admin") return pathname === "/admin" || pathname === "/admin/";
  if (to === "/admin/don-hang") return pathname.startsWith("/admin/don-hang") || pathname.startsWith("/orders/");
  return pathname === to || pathname.startsWith(`${to}/`);
}

function pageTitle(pathname: string, role: Role): string {
  if (pathname.startsWith("/orders/create") || pathname.startsWith("/admin/don-moi")) return "Tạo đơn hàng mới";
  if (pathname.startsWith("/admin/tem/")) return "Tem đơn";
  if (pathname.startsWith("/admin/don-hang/") && pathname !== "/admin/don-hang" && pathname !== "/admin/don-hang/") return "Chi tiết đơn";
  if (pathname.startsWith("/admin/khach/") && pathname !== "/admin/khach" && pathname !== "/admin/khach/") return "Hồ sơ khách";
  if (pathname.startsWith("/admin/album/") && pathname !== "/admin/album" && pathname !== "/admin/album/") return "Album ảnh";
  const items = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).filter((item) => item.roles.includes(role));
  const match = items
    .filter((item) => pathActive(pathname, item.to))
    .sort((a, b) => b.to.length - a.to.length)[0];
  if (!match) return "Quản trị";
  if (match.to === "/admin/luong" && role !== "owner") return "Lương của tôi";
  return match.label;
}

function initials(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("");
  return letters.toUpperCase().slice(0, 2) || "U";
}

export function AdminShell() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [menuOpen, setMenuOpen] = useState(false);
  const [narrow, setNarrow] = useState(false);
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

  const title = pageTitle(pathname, role);
  const groups = modulesForRole(role, me.data.modules);

  const bottom = [
    { to: "/admin" as const, label: "Trang chủ", icon: LayoutDashboard },
    { to: "/admin/don-hang" as const, label: "Đơn", icon: ClipboardList },
    { to: "/admin/lich" as const, label: "Lịch", icon: CalendarDays },
    role === "production"
      ? { to: "/admin/san-xuat" as const, label: "Xưởng", icon: ClipboardList }
      : { to: "/admin/chat" as const, label: "Chat", icon: MessageCircle },
  ];

  return (
    <div className="admin-desk flex min-h-screen bg-[#f3f4f7]">
      {menuOpen ? (
        <button type="button" className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside
        className={`print:hidden fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-white pt-[env(safe-area-inset-top)] transition-[width] md:sticky ${narrow ? "md:w-[4.5rem]" : "md:w-[190px]"} w-[190px] ${menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
          <span className="flex size-8 items-center justify-center rounded-xl bg-[#2563eb] text-[11px] font-bold text-white">TT</span>
          {narrow ? null : <span className="truncate text-[13px] font-bold tracking-tight text-foreground">Thiên Thiên</span>}
          <button type="button" className="ml-auto flex size-7 items-center justify-center rounded md:hidden" aria-label="Đóng" onClick={() => setMenuOpen(false)}>
            <X className="size-4" />
          </button>
        </div>
        <nav aria-label="Mục quản trị" className="flex-1 overflow-y-auto px-2 py-2">
          {groups.map((group) => (
            <div key={group.title || "home"} className="mb-2">
              {group.title && !narrow ? <p className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">{group.title}</p> : null}
              {group.items.map((item) => {
                const Icon = ICONS[item.to] ?? LayoutDashboard;
                const active = pathActive(pathname, item.to);
                const label = item.to === "/admin/luong" && role !== "owner" ? "Lương của tôi" : item.label;
                const tone = groupTile(group.title);
                return (
                  <Link
                    key={`${item.to}-${item.label}`}
                    to={item.to}
                    title={label}
                    aria-current={active ? "page" : undefined}
                    className={`mb-0.5 flex min-h-9 items-center gap-2 rounded-xl px-1.5 text-[13px] ${active ? "bg-[#e0eefe] font-semibold text-[#1d4ed8]" : "text-sidebar-foreground hover:bg-[#f8fafc]"}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#2563eb] text-white" : tone}`}>
                      <Icon className="size-3.5" />
                    </span>
                    {narrow ? null : <span className="truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
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
          {pathname !== "/admin" && pathname !== "/admin/" ? (
            <button type="button" className="hidden items-center gap-1 text-[13px] font-medium text-muted-foreground md:inline-flex" onClick={() => router.history.back()}>
              <ChevronLeft className="size-4" />
              Trở lại
            </button>
          ) : null}
          <button type="button" className="flex size-8 items-center justify-center rounded md:hidden" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu className="size-4" />
          </button>
          <span className="truncate text-[15px] font-semibold">{title}</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold">{me.data.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold text-white">{initials(me.data.name)}</span>
          </span>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-4 pb-[calc(var(--manage-mobile-nav-height)+1rem)] md:px-6 md:pb-6">
          {me.data.mustChangePassword ? (
            <ForcePasswordChange
              onDone={() => {
                void queryClient.invalidateQueries({ queryKey: ["me"] });
              }}
            />
          ) : (
            <Outlet />
          )}
        </main>
        <nav aria-label="Điều hướng dưới" className="print:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#e5e7eb] bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {bottom.map((item) => {
            const Icon = item.icon;
            const active = pathActive(pathname, item.to);
            return (
              <Link key={item.to} to={item.to} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? "text-[#2563eb]" : "text-muted-foreground"}`}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <button type="button" className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-muted-foreground" onClick={() => setMenuOpen(true)}>
            <Menu className="size-4" />
            Menu
          </button>
        </nav>
      </div>
    </div>
  );
}

function groupTile(title: string | undefined): string {
  if (title === "Sản xuất") return "bg-[#f3e8ff] text-[#9333ea]";
  if (title === "Vận hành") return "bg-[#ffedd5] text-[#ea580c]";
  if (title === "Tài chính") return "bg-[#dcfce7] text-[#16a34a]";
  if (title === "Hệ thống") return "bg-[#f1f5f9] text-[#475569]";
  return "bg-[#e0eefe] text-[#2563eb]";
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

function AdminLogin({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="admin-desk flex min-h-screen items-center justify-center px-4 py-10">
      <form
        className="glass-card w-full max-w-md p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          try {
            const result = await loginStaff({ data: { email, password, code: code || undefined } });
            if (result && "needsTotp" in result) {
              setNeedsCode(true);
              toast.message("Nhập mã 6 số từ ứng dụng xác thực.");
              return;
            }
            queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
            toast.success("Đã đăng nhập");
            onDone();
          } catch (error) {
            toast.error((error as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <img src={LOGO_HORIZONTAL} alt="Nhà In Thiên Thiên" className="mx-auto h-12 w-auto" />
        <h1 className="mt-4 text-center text-2xl font-bold text-primary">Đăng nhập nội bộ</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Chủ, sale và sản xuất — mỗi người một tài khoản. Đăng nhập chưa phải chấm công.</p>
        <div className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="username" className="mt-1 min-h-12" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" autoComplete="current-password" className="mt-1 min-h-12" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {needsCode ? (
            <div>
              <Label htmlFor="totp">Mã xác thực 6 số</Label>
              <Input id="totp" inputMode="numeric" autoComplete="one-time-code" className="mt-1 min-h-12" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
          ) : null}
          <Button type="submit" className="min-h-12 w-full" disabled={loading}>
            {loading ? "Đang vào…" : "Đăng nhập"}
          </Button>
        </div>
      </form>
    </div>
  );
}
