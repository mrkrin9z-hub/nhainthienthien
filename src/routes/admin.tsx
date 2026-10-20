import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  LayoutDashboard,
  LogOut,
  Menu,
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
import { LOGO_HORIZONTAL } from "@/lib/assets";
import { changeOwnPassword, getMe, loginStaff, logoutStaff } from "@/lib/admin.functions";
import { ROLE_LABEL, type Role } from "@/domain/types";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Quản trị — Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const ICONS: Record<string, typeof LayoutDashboard> = {
  "/admin": LayoutDashboard,
  "/admin/don-hang": ClipboardList,
  "/admin/don-moi": ClipboardList,
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

const GROUPS: { title: string; items: { to: string; label: string; roles: Role[] }[] }[] = [
  {
    title: "",
    items: [{ to: "/admin", label: "Trang chủ", roles: ["owner", "sale", "production"] }],
  },
  {
    title: "Kinh doanh",
    items: [
      { to: "/admin/don-hang", label: "Đơn hàng", roles: ["owner", "sale", "production"] },
      { to: "/admin/khach", label: "Khách hàng", roles: ["owner", "sale"] },
      { to: "/admin/thu", label: "Thu tiền", roles: ["owner", "sale"] },
    ],
  },
  {
    title: "Sản xuất",
    items: [
      { to: "/admin/san-xuat", label: "Sản xuất", roles: ["owner", "sale", "production"] },
      { to: "/admin/giao-hang", label: "Giao hàng", roles: ["owner", "sale", "production"] },
      { to: "/admin/san-pham", label: "Sản phẩm", roles: ["owner"] },
      { to: "/admin/gia", label: "Bảng giá", roles: ["owner", "sale"] },
      { to: "/admin/kho", label: "Kho", roles: ["owner", "sale", "production"] },
      { to: "/admin/album", label: "Album ảnh", roles: ["owner", "sale", "production"] },
    ],
  },
  {
    title: "Vận hành",
    items: [
      { to: "/admin/nhan-vien", label: "Nhân viên", roles: ["owner"] },
      { to: "/admin/cham-cong", label: "Chấm công", roles: ["owner", "sale", "production"] },
      { to: "/admin/tai-khoan", label: "Tài khoản", roles: ["sale", "production"] },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { to: "/admin/vi", label: "Ví tiền", roles: ["owner", "sale"] },
      { to: "/admin/chi-phi", label: "Chi phí", roles: ["owner"] },
      { to: "/admin/loi-nhuan", label: "Thu chi", roles: ["owner"] },
      { to: "/admin/bao-cao", label: "Báo cáo", roles: ["owner"] },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { to: "/admin/nhat-ky", label: "Nhật ký", roles: ["owner"] },
      { to: "/admin/cai-dat", label: "Cài đặt", roles: ["owner"] },
    ],
  },
];

function pathActive(pathname: string, to: string) {
  if (to === "/admin") return pathname === "/admin" || pathname === "/admin/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function pageTitle(pathname: string, role: Role): string {
  if (pathname.startsWith("/admin/don-moi")) return "Tạo đơn hàng mới";
  if (pathname.startsWith("/admin/tem/")) return "Tem đơn";
  if (pathname.startsWith("/admin/don-hang/") && pathname !== "/admin/don-hang" && pathname !== "/admin/don-hang/") return "Chi tiết đơn";
  if (pathname.startsWith("/admin/khach/") && pathname !== "/admin/khach" && pathname !== "/admin/khach/") return "Hồ sơ khách";
  const items = GROUPS.flatMap((group) => group.items).filter((item) => item.roles.includes(role));
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

function AdminLayout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [menuOpen, setMenuOpen] = useState(false);

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
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.includes(role)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="admin-desk flex min-h-screen">
      {menuOpen ? (
        <button type="button" className="fixed inset-0 z-40 bg-foreground/40 md:hidden" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar pt-[env(safe-area-inset-top)] md:sticky md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-3">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">TT</span>
          <span className="truncate text-[13px] font-bold tracking-tight text-foreground">Thiên Thiên</span>
          <button type="button" className="ml-auto flex size-7 items-center justify-center rounded md:hidden" aria-label="Đóng" onClick={() => setMenuOpen(false)}>
            <X className="size-4" />
          </button>
        </div>
        <nav aria-label="Mục quản trị" className="flex-1 overflow-y-auto px-2 py-2">
          {groups.map((group) => (
            <div key={group.title || "home"} className="mb-2">
              {group.title ? <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group.title}</p> : null}
              {group.items.map((item) => {
                const Icon = ICONS[item.to] ?? LayoutDashboard;
                const active = pathActive(pathname, item.to);
                const label = item.to === "/admin/luong" && role !== "owner" ? "Lương của tôi" : item.label;
                return (
                  <Link
                    key={`${item.to}-${item.label}`}
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={`mb-0.5 flex min-h-9 items-center gap-2 rounded-md px-2.5 text-[13px] ${active ? "bg-primary font-semibold text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {initials(me.data.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{me.data.name}</span>
              <span className="block text-[11px] text-muted-foreground">{ROLE_LABEL[role]}</span>
            </span>
            <Button variant="ghost" size="icon" className="size-8" title="Đăng xuất" onClick={() => void logout()}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background px-3 pt-[env(safe-area-inset-top)] md:px-5">
          <button type="button" className="flex size-8 items-center justify-center rounded md:hidden" aria-label="Mở menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu className="size-4" />
          </button>
          <span className="truncate text-[15px] font-semibold">{title}</span>
          <span className="ml-auto hidden text-right sm:block">
            <span className="block text-sm font-semibold">{me.data.name}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
          </span>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 md:px-6">
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
      </div>
    </div>
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
      <h1 className="text-2xl font-extrabold text-primary">Đổi mật khẩu lần đầu</h1>
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
        <p className="mt-1 text-center text-sm text-muted-foreground">Chủ, sale và sản xuất — mỗi người một tài khoản. Trên iPhone: Thêm vào Màn hình chính.</p>
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
            {loading ? "Đang vào…" : "Vào ca làm"}
          </Button>
        </div>
      </form>
    </div>
  );
}
