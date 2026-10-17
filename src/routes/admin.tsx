import { createFileRoute, Link, Outlet, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: "/admin", label: "Tổng quan", roles: ["owner", "sale", "production"] },
  { to: "/admin/gia", label: "Bảng giá", roles: ["owner", "sale"] },
  { to: "/admin/don-hang", label: "Đơn hàng", roles: ["owner", "sale", "production"] },
  { to: "/admin/khach", label: "Khách", roles: ["owner", "sale"] },
  { to: "/admin/nhac-khach", label: "Nhắc khách", roles: ["owner", "sale"] },
  { to: "/admin/kho", label: "Kho", roles: ["owner", "sale", "production"] },
  { to: "/admin/giao-hang", label: "Giao hàng", roles: ["owner", "sale", "production"] },
  { to: "/admin/cod", label: "Đối soát COD", roles: ["owner", "sale"] },
  { to: "/admin/nhap-don", label: "Nhập đơn sàn", roles: ["owner", "sale"] },
  { to: "/admin/anh", label: "Ảnh web", roles: ["owner", "sale"] },
  { to: "/admin/cham-cong", label: "Chấm công", roles: ["owner", "sale", "production"] },
  { to: "/admin/luong", label: "Lương", roles: ["owner", "sale", "production"] },
  { to: "/admin/loi-nhuan", label: "Lãi lỗ", roles: ["owner"] },
  { to: "/admin/nhat-ky", label: "Nhật ký", roles: ["owner"] },
  { to: "/admin/sao-luu", label: "Sao lưu", roles: ["owner"] },
  { to: "/admin/ket-noi", label: "Kết nối", roles: ["owner"] },
  { to: "/admin/tai-khoan", label: "Tài khoản", roles: ["owner", "sale", "production"] },
  { to: "/admin/cai-dat", label: "Cài đặt", roles: ["owner"] },
];

function AdminLayout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });

  if (me.isLoading) return <div className="p-10 text-center text-muted-foreground">Đang tải…</div>;
  if (!me.data) return <AdminLogin onDone={() => queryClient.invalidateQueries({ queryKey: ["me"] })} />;

  const role = me.data.role;
  return (
    <div className="min-h-screen bg-background">
      <header className="glass-panel sticky top-0 z-40">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-3 px-4 py-2 md:px-6">
          <Link to="/" className="min-w-0">
            <img src={LOGO_HORIZONTAL} alt="Nhà In Thiên Thiên" className="h-9 w-auto max-w-[150px] object-contain" />
          </Link>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {me.data.name}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto min-h-11"
            onClick={async () => {
              await logoutStaff();
              queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
              await queryClient.invalidateQueries({ queryKey: ["me"] });
              toast.success("Đã đăng xuất");
              router.navigate({ to: "/admin" });
            }}
          >
            Đăng xuất
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 md:px-6">
          {NAV.filter((item) => item.roles.includes(role)).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/admin" }}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-card px-4 text-sm font-semibold text-foreground/80"
            >
              {item.to === "/admin/luong" && role !== "owner" ? "Lương của tôi" : item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6">
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
  );
}
