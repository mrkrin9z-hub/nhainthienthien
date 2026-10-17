import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getIntegrations, getMe, saveIntegration } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/ket-noi")({
  component: ConnectPage,
});

const FIELDS: { id: "tiktok" | "shopee" | "meta" | "carrier"; label: string; hint: string }[] = [
  { id: "tiktok", label: "TikTok Shop", hint: "Khóa API để sau. Đơn hiện nhập từ file." },
  { id: "shopee", label: "Shopee", hint: "API làm sau J&T. Đơn hiện nhập từ file." },
  { id: "meta", label: "Meta / Facebook", hint: "Token trang hoặc ứng dụng, chưa đồng bộ đơn." },
  {
    id: "carrier",
    label: "J&T Express",
    hint: "Khóa API để sau. Chưa có khóa thì ghi vận đơn và phí bằng tay, vẫn in tem 100×150.",
  },
];

function ConnectPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const status = useQuery({
    queryKey: ["integrations"],
    queryFn: () => getIntegrations(),
    enabled: me.data?.role === "owner",
  });
  useEffect(() => {
    const drive = new URLSearchParams(window.location.search).get("drive");
    if (drive === "ok") toast.success("Đã kết nối Google Drive");
    if (drive === "thieu") toast.error("Nhập Client ID và Client secret trước");
    if (drive === "tu-choi") toast.error("Google chưa cấp quyền Drive");
    if (drive === "loi") toast.error("Không kết nối được Google Drive");
  }, []);
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role !== "owner") return <p className="text-lg font-semibold text-primary">Chỉ chủ xem.</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Kết nối</h1>
      <p className="text-sm text-muted-foreground">
        Ô để trống thì app vẫn chạy. Khóa chỉ được lưu, không hiện lại. Chưa có khóa thì không gọi API ngoài.
      </p>
      <DriveCard
        clientSaved={Boolean(status.data?.google_client_id)}
        secretSaved={Boolean(status.data?.google_client_secret)}
        connected={Boolean(status.data?.google_drive)}
      />
      {FIELDS.map((field) => (
        <div key={field.id} className="glass-card rounded-3xl p-4">
          <SecretField field={field} saved={Boolean(status.data?.[field.id])} />
        </div>
      ))}
    </div>
  );
}

function DriveCard({
  clientSaved,
  secretSaved,
  connected,
}: {
  clientSaved: boolean;
  secretSaved: boolean;
  connected: boolean;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const redirect = `${origin}/api/admin/drive/callback`;
  const ready = clientSaved && secretSaved;
  return (
    <section className="glass-card space-y-3 rounded-3xl p-4">
      <h2 className="font-bold text-primary">Google Drive</h2>
      <p className="text-xs text-muted-foreground">
        Ảnh khách lên Drive của chủ, mỗi đơn một thư mục. Chưa kết nối thì ảnh lưu tạm trên KV, tối đa 10MB. App không chặn khi chưa có khóa.
      </p>
      <p className="break-all text-xs text-muted-foreground">
        Redirect URI trên Google Cloud: {origin ? redirect : "/api/admin/drive/callback"}
      </p>
      <SecretField
        field={{ id: "google_client_id", label: "Google Client ID", hint: "Tạo ở Google Cloud, loại Web." }}
        saved={clientSaved}
        inputType="text"
      />
      <SecretField
        field={{ id: "google_client_secret", label: "Google Client secret", hint: "Cùng ứng dụng với Client ID." }}
        saved={secretSaved}
      />
      <p className="text-sm font-semibold">{connected ? "Đã kết nối Google Drive." : "Chưa kết nối Google Drive."}</p>
      {connected ? (
        <DisconnectDrive />
      ) : ready ? (
        <Button asChild className="min-h-12">
          <a href="/api/admin/drive/start">Kết nối Google Drive</a>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Nhập Client ID và Client secret, bấm Lưu, rồi mới bấm Kết nối Google Drive.</p>
      )}
    </section>
  );
}

function DisconnectDrive() {
  const queryClient = useQueryClient();
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      onClick={async () => {
        await saveIntegration({ data: { provider: "google_drive", value: "" } });
        toast.success("Đã ngắt Google Drive");
        await queryClient.invalidateQueries({ queryKey: ["integrations"] });
      }}
    >
      Ngắt kết nối
    </Button>
  );
}

function SecretField({
  field,
  saved,
  inputType = "password",
}: {
  field: { id: string; label: string; hint: string };
  saved: boolean;
  inputType?: "password" | "text";
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  return (
    <form
      className="space-y-2"
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
        type={inputType}
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
