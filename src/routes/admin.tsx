import { createFileRoute, Link, Outlet, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Archive,
  BarChart3,
  Bell,
  ClipboardList,
  Clock,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Plug,
  Receipt,
  ScrollText,
  Settings,
  Tags,
  Target,
  Truck,
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
import type { Role } from "@/domain/types";

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
  "/admin/giao-hang": Truck,
  "/admin/cod": Wallet,
  "/admin/nhap-don": ClipboardList,
  "/admin/khach": Users,
  "/admin/nhac-khach": Bell,
  "/admin/gia": Tags,
  "/admin/kho": Package,
  "/admin/anh": Image,
  "/admin/cham-cong": Clock,
  "/admin/luong": Receipt,
  "/admin/tai-khoan": UserRound,
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
    title: "Vận hành",
    items: [
      { to: "/admin", label: "Tổng quan", roles: ["owner", "sale", "production"] },
      { to: "/admin/don-hang", label: "Đơn hàng", roles: ["owner", "sale", "production"] },
      { to: "/admin/giao-hang", label: "Giao hàng", roles: ["owner", "sale", "production"] },
      { to: "/admin/cod", label: "Đối soát COD", roles: ["owner", "sale"] },
      { to: "/admin/nhap-don", label: "Nhập đơn sàn", roles: ["owner", "sale"] },
    ],
  },
  {
    title: "Khách và hàng",
    items: [
      { to: "/admin/khach", label: "Khách hàng", roles: ["owner", "sale"] },
      { to: "/admin/nhac-khach", label: "Nhắc khách", roles: ["owner", "sale"] },
      { to: "/admin/san-pham", label: "Sản phẩm web", roles: ["owner"] },
      { to: "/admin/gia", label: "Bảng giá", roles: ["owner", "sale"] },
      { to: "/admin/kho", label: "Kho", roles: ["owner", "sale", "production"] },
      { to: "/admin/anh", label: "Ảnh web", roles: ["owner", "sale"] },
    ],
  },
  {
    title: "Nhân sự",
    items: [
      { to: "/admin/cham-cong", label: "Chấm công", roles: ["owner", "sale", "production"] },
      { to: "/admin/luong", label: "Lương", roles: ["owner", "sale", "production"] },
      { to: "/admin/tai-khoan", label: "Tài khoản", roles: ["owner", "sale", "production"] },
    ],
  },
  {
    title: "Tài chính",
    items: [
      { to: "/admin/loi-nhuan", label: "Thu chi", roles: ["owner"] },
      { to: "/admin/bao-cao", label: "Báo cáo", roles: ["owner"] },
      { to: "/admin/kpi", label: "KPI", roles: ["owner", "sale"] },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { to: "/admin/nhat-ky", label: "Nhật ký", roles: ["owner"] },
      { to: "/admin/sao-luu", label: "Sao lưu", roles: ["owner"] },
      { to: "/admin/ket-noi", label: "Kết nối", roles: ["owner"] },
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

function dailyTabs(role: Role): { to: string; label: string; icon: typeof LayoutDashboard }[] {
  if (role === "production") {
    return [
      { to: "/admin", label: "Tổng quan", icon: LayoutDashboard },
      { to: "/admin/don-hang", label: "Đơn", icon: ClipboardList },
      { to: "/admin/giao-hang", label: "Giao", icon: Truck },
      { to: "/admin/cham-cong", label: "Công", icon: Clock },
    ];
  }
  return [
    { to: "/admin", label: "Tổng quan", icon: LayoutDashboard },
    { to: "/admin/don-hang", label: "Đơn", icon: ClipboardList },
    { to: "/admin/khach", label: "Khách", icon: Users },
    { to: "/admin/cham-cong", label: "Công", icon: Clock },
  ];
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
  const tabs = dailyTabs(role);

  return (
    <div className="min-h-screen bg-muted/40 md:pl-60">
      {menuOpen ? (
        <button type="button" className="fixed inset-0 z-40 bg-foreground/40 md:hidden" aria-label="Đóng menu" onClick={() => setMenuOpen(false)} />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card pt-[env(safe-area-inset-top)] text-foreground transition-transform md:w-60 md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <img src={LOGO_HORIZONTAL} alt="Nhà In Thiên Thiên" className="h-8 w-auto max-w-[10rem] object-contain" />
          <button type="button" className="flex size-10 items-center justify-center rounded-full md:hidden" aria-label="Đóng" onClick={() => setMenuOpen(false)}>
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => item.roles.includes(role));
            if (items.length === 0) return null;
            return (
              <div key={group.title}>
                <p className="px-3 font-sans text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">{group.title}</p>
                <div className="mt-1 space-y-0.5">
                  {items.map((item) => {
                    const Icon = ICONS[item.to] ?? LayoutDashboard;
                    const active = pathActive(pathname, item.to);
                    const label = item.to === "/admin/luong" && role !== "owner" ? "Lương của tôi" : item.label;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${active ? "bg-primary/10 text-primary" : "text-foreground/75"}`}
                        onClick={() => setMenuOpen(false)}
                      >
                        <Icon className="size-4 shrink-0" />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <p className="truncate px-2 text-sm font-semibold">{me.data.name}</p>
          <p className="px-2 text-xs text-muted-foreground">{role === "owner" ? "Chủ tiệm" : role === "sale" ? "Sale" : "Sản xuất"}</p>
          <Button variant="outline" className="mt-3 min-h-11 w-full" onClick={() => void logout()}>
            <LogOut className="size-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>
      <header className="sticky top-0 z-30 border-b border-border bg-card px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center gap-2">
          <p className="min-w-0 truncate text-base font-semibold text-primary">{title}</p>
          <p className="ml-auto truncate text-sm text-muted-foreground">{me.data.name}</p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 pb-28 sm:px-4 md:px-8 md:py-6 md:pb-8">
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
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Việc hằng ngày">
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathActive(pathname, tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon className="size-5" />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${menuOpen ? "text-primary" : "text-muted-foreground"}`}
            aria-label="Mở toàn bộ menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <MoreHorizontal className="size-5" /> : <Menu className="size-5" />}
            Thêm
          </button>
        </div>
      </nav>
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
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
      <p className="text-center font-sans text-xs font-bold tracking-[0.18em] text-primary uppercase">Nhà In Thiên Thiên</p>
      <h1 className="mt-3 text-center text-4xl text-primary">Một sổ cho cả quy trình in.</h1>
      <div className="mt-6 flex items-center justify-center">
      <form
        className="glass-card w-full max-w-md rounded-3xl p-6"
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
        <h1 className="mt-4 text-center text-2xl font-extrabold text-primary">Đăng nhập nội bộ</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Chủ, sale và sản xuất — mỗi người một tài khoản.</p>
        <p className="mt-1 text-center text-sm text-muted-foreground">Trên iPhone: chia sẻ rồi chọn Thêm vào Màn hình chính.</p>
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
          <Button type="submit" className="min-h-12 w-full bg-accent text-accent-foreground" disabled={loading}>
            {loading ? "Đang vào…" : "Vào ca làm"}
          </Button>
        </div>
      </form>
      </div>
      </div>
    </div>
  );
}
