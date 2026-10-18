import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { StaffLinks } from "@/components/admin/sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword, finishTotp, getMe, startTotp, stopTotp } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tai-khoan")({
  component: AccountPage,
});

function AccountPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [offPassword, setOffPassword] = useState("");
  const [offCode, setOffCode] = useState("");
  if (!me.data) return <p className="text-muted-foreground">Đang tải…</p>;
  return (
    <div className="space-y-4">
      <StaffLinks />
      <h1 className="text-2xl font-semibold text-primary">Tài khoản của tôi</h1>
      <p className="text-sm text-muted-foreground">
        {me.data.email}
        {me.data.totpEnabled ? " · xác thực 2 lớp đang bật" : " · chưa bật xác thực 2 lớp"}
      </p>
      <form
        className="glass-card space-y-3 rounded-3xl p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          await changeOwnPassword({ data: { current, next } });
          setCurrent("");
          setNext("");
          toast.success("Đã đổi mật khẩu");
        }}
      >
        <h2 className="font-bold text-primary">Đổi mật khẩu</h2>
        <Label htmlFor="pw-current">Mật khẩu hiện tại</Label>
        <Input id="pw-current" type="password" className="min-h-12" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        <Label htmlFor="pw-next">Mật khẩu mới</Label>
        <Input id="pw-next" type="password" className="min-h-12" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
        <Button type="submit" className="min-h-11">
          Lưu mật khẩu
        </Button>
      </form>
      <section className="glass-card space-y-3 rounded-3xl p-4">
        <h2 className="font-bold text-primary">Xác thực 2 lớp</h2>
        <p className="text-sm text-muted-foreground">
          Không bắt buộc. Sau khi bật, đăng nhập của chính tài khoản này cần mã 6 số. Chủ cũng vậy.
        </p>
        {me.data.totpEnabled ? (
          <form
            className="space-y-2"
            onSubmit={async (event) => {
              event.preventDefault();
              await stopTotp({ data: { password: offPassword, code: offCode } });
              setOffPassword("");
              setOffCode("");
              toast.success("Đã tắt xác thực 2 lớp");
              await queryClient.invalidateQueries({ queryKey: ["me"] });
            }}
          >
            <Label htmlFor="off-password">Mật khẩu</Label>
            <Input id="off-password" type="password" className="min-h-12" value={offPassword} onChange={(e) => setOffPassword(e.target.value)} required />
            <Label htmlFor="off-code">Mã 6 số hiện tại</Label>
            <Input id="off-code" inputMode="numeric" className="min-h-12" value={offCode} onChange={(e) => setOffCode(e.target.value)} required />
            <Button type="submit" variant="outline" className="min-h-11">
              Tắt
            </Button>
          </form>
        ) : (
          <>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={async () => {
                const nextSetup = await startTotp();
                setSetup(nextSetup);
              }}
            >
              Tạo mã bí mật
            </Button>
            {setup ? (
              <form
                className="space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await finishTotp({ data: { code } });
                  setCode("");
                  setSetup(null);
                  toast.success("Đã bật xác thực 2 lớp");
                  await queryClient.invalidateQueries({ queryKey: ["me"] });
                }}
              >
                <p className="break-all font-mono text-sm">{setup.secret}</p>
                <p className="break-all text-xs text-muted-foreground">{setup.uri}</p>
                <p className="text-sm">Nhập mã này vào ứng dụng xác thực, rồi gõ 6 số bên dưới.</p>
                <Input inputMode="numeric" className="min-h-12" value={code} onChange={(e) => setCode(e.target.value)} required />
                <Button type="submit" className="min-h-11">
                  Xác nhận và bật
                </Button>
              </form>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
