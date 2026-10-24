import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginStaff } from "@/lib/admin.functions";

export function AdminLogin({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="admin-desk flex min-h-screen items-center justify-center px-4 py-10">
      <form
        className="glass-card w-full max-w-md p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setLoading(true);
          setMessage("");
          try {
            const result = await loginStaff({ data: { email, password, code: code || undefined } });
            if (result && "needsTotp" in result) {
              setNeedsCode(true);
              setMessage("Nhập mã 6 số từ ứng dụng xác thực.");
              return;
            }
            queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" });
            onDone();
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <p className="text-center text-lg font-semibold text-primary">Nhà In Thiên Thiên</p>
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
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <Button type="submit" className="min-h-12 w-full" disabled={loading}>
            {loading ? "Đang vào…" : "Đăng nhập"}
          </Button>
        </div>
      </form>
    </div>
  );
}
