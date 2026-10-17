import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getIntegrations, getMe, saveIntegration } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/ket-noi")({
  component: ConnectPage,
});

const FIELDS: { id: "tiktok" | "shopee" | "meta" | "zalo" | "carrier"; label: string; hint: string }[] = [
  { id: "tiktok", label: "TikTok Shop", hint: "Khóa API cửa hàng, chưa gọi sang TikTok." },
  { id: "shopee", label: "Shopee", hint: "Khóa API cửa hàng, chưa gọi sang Shopee." },
  { id: "meta", label: "Meta / Facebook", hint: "Token trang hoặc ứng dụng, chưa đồng bộ đơn." },
  { id: "zalo", label: "Zalo OA", hint: "Khóa Official Account, chưa gửi tin." },
  { id: "carrier", label: "Đơn vị vận chuyển", hint: "Khóa hãng giao hàng, chưa tạo vận đơn." },
];

function ConnectPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const status = useQuery({
    queryKey: ["integrations"],
    queryFn: () => getIntegrations(),
    enabled: me.data?.role === "owner",
  });
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role !== "owner") return <p className="text-lg font-semibold text-primary">Chỉ chủ xem.</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Kết nối</h1>
      <p className="text-sm text-muted-foreground">
        Ô để trống. Khóa chỉ được lưu, không hiện lại và chưa dùng để gọi API nào.
      </p>
      {FIELDS.map((field) => (
        <SecretField key={field.id} field={field} saved={Boolean(status.data?.[field.id])} />
      ))}
    </div>
  );
}

function SecretField({
  field,
  saved,
}: {
  field: (typeof FIELDS)[number];
  saved: boolean;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  return (
    <form
      className="glass-card space-y-2 rounded-3xl p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await saveIntegration({ data: { provider: field.id, value } });
        setValue("");
        toast.success(value.trim() ? "Đã lưu khóa" : "Đã xóa khóa");
        await queryClient.invalidateQueries({ queryKey: ["integrations"] });
      }}
    >
      <Label htmlFor={field.id}>{field.label}</Label>
      <p className="text-xs text-muted-foreground">
        {field.hint} {saved ? "Đã có khóa." : "Chưa lưu."}
      </p>
      <Input
        id={field.id}
        type="password"
        autoComplete="off"
        className="min-h-12"
        placeholder={saved ? "Nhập khóa mới để thay, để trống rồi lưu để xóa" : "Dán khóa vào đây"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button type="submit" variant="outline" className="min-h-11">
        Lưu
      </Button>
    </form>
  );
}
