import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getIntegrations, getMe, pullMarketplace, saveIntegration } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/ket-noi")({
  component: ConnectPage,
});

const FIELDS: { id: "meta" | "carrier"; label: string; hint: string }[] = [
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
    const tiktok = new URLSearchParams(window.location.search).get("tiktok");
    if (tiktok === "ok") toast.success("Đã kết nối TikTok Shop. Đơn 7 ngày sẽ đổ vào sổ, đơn đã có thì bỏ qua.");
    if (tiktok === "thieu") toast.error("Nhập App key, App secret và Service ID trước");
    if (tiktok === "tu-choi") toast.error("TikTok Shop chưa cấp quyền");
    if (tiktok === "loi") toast.error("Không kết nối được TikTok Shop");
    const shopee = new URLSearchParams(window.location.search).get("shopee");
    if (shopee === "ok") toast.success("Đã kết nối Shopee. Đơn 7 ngày sẽ đổ vào sổ, đơn đã có thì bỏ qua.");
    if (shopee === "thieu") toast.error("Nhập Partner ID và Partner key trước");
    if (shopee === "tu-choi") toast.error("Shopee chưa cấp quyền");
    if (shopee === "loi") toast.error("Không kết nối được Shopee");
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
      <ShopCard
        title="TikTok Shop"
        channel="tiktok"
        connected={Boolean(status.data?.tiktok_shop)}
        ready={Boolean(status.data?.tiktok_app_key && status.data?.tiktok_app_secret && status.data?.tiktok_service_id)}
        redirectPath="/api/admin/tiktok/callback"
        startPath="/api/admin/tiktok/start"
        disconnectProvider="tiktok_shop"
        steps="Tạo app Seller tại Partner Center. Redirect URL phải đúng dòng bên dưới. App key, App secret và Service ID lấy trong app."
      >
        <SecretField field={{ id: "tiktok_app_key", label: "App key", hint: "Khóa app, không phải mã đơn." }} saved={Boolean(status.data?.tiktok_app_key)} inputType="text" />
        <SecretField field={{ id: "tiktok_app_secret", label: "App secret", hint: "Dùng để ký request. Không hiện lại sau khi lưu." }} saved={Boolean(status.data?.tiktok_app_secret)} />
        <SecretField field={{ id: "tiktok_service_id", label: "Service ID", hint: "Mã service trên trang app, để mở trang ủy quyền." }} saved={Boolean(status.data?.tiktok_service_id)} inputType="text" />
      </ShopCard>
      <ShopCard
        title="Shopee"
        channel="shopee"
        connected={Boolean(status.data?.shopee_shop)}
        ready={Boolean(status.data?.shopee_partner_id && status.data?.shopee_partner_key)}
        redirectPath="/api/admin/shopee/callback"
        startPath="/api/admin/shopee/start"
        disconnectProvider="shopee_shop"
        steps="Tạo app tại Shopee Open Platform. Redirect URL phải đúng dòng bên dưới. Partner ID là số, Partner key để ký."
      >
        <SecretField field={{ id: "shopee_partner_id", label: "Partner ID", hint: "Số partner_id của app." }} saved={Boolean(status.data?.shopee_partner_id)} inputType="text" />
        <SecretField field={{ id: "shopee_partner_key", label: "Partner key", hint: "Khóa ký. Không hiện lại sau khi lưu." }} saved={Boolean(status.data?.shopee_partner_key)} />
      </ShopCard>
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
        Ảnh khách lên thẳng Drive của chủ, không giới hạn dung lượng. Album theo số điện thoại nằm trong thư mục Album khách. Chưa kết nối thì ảnh lưu tạm, mỗi ảnh tối đa 10MB.
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

function ShopCard({
  title,
  channel,
  connected,
  ready,
  redirectPath,
  startPath,
  disconnectProvider,
  steps,
  children,
}: {
  title: string;
  channel: "tiktok" | "shopee";
  connected: boolean;
  ready: boolean;
  redirectPath: string;
  startPath: string;
  disconnectProvider: "tiktok_shop" | "shopee_shop";
  steps: string;
  children: ReactNode;
}) {
  const [origin, setOrigin] = useState("");
  const queryClient = useQueryClient();
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <section className="glass-card space-y-3 rounded-3xl p-4">
      <h2 className="font-bold text-primary">{title}</h2>
      <p className="text-xs text-muted-foreground">
        {steps} Đơn 7 ngày gần nhất tự đổ khi mở trang quản trị, hoặc bấm Lấy đơn. Đơn đã có cùng mã sàn không tạo thêm. Đơn chưa thanh toán và đơn hủy không vào. SKU sàn map ở Nhập đơn sàn. File Excel vẫn dùng được.
      </p>
      <p className="break-all text-xs text-muted-foreground">Redirect URL: {origin ? `${origin}${redirectPath}` : redirectPath}</p>
      {children}
      <p className="text-sm font-semibold">{connected ? `Đã kết nối ${title}.` : `Chưa kết nối ${title}.`}</p>
      {connected ? (
        <div className="flex flex-wrap gap-2">
          <PullOrders channel={channel} />
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              await saveIntegration({ data: { provider: disconnectProvider, value: "" } });
              toast.success(`Đã ngắt ${title}`);
              await queryClient.invalidateQueries({ queryKey: ["integrations"] });
            }}
          >
            Ngắt kết nối
          </Button>
        </div>
      ) : ready ? (
        <Button asChild className="min-h-12">
          <a href={startPath}>Kết nối {title}</a>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Nhập khóa, bấm Lưu từng ô, rồi mới bấm Kết nối {title}.</p>
      )}
    </section>
  );
}

function PullOrders({ channel }: { channel: "tiktok" | "shopee" }) {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  return (
    <Button
      type="button"
      className="min-h-11"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const result = await pullMarketplace({ data: { channel } });
          toast.success(`Đã đổ ${result.codes.length} đơn. Bỏ qua ${result.duplicateCount} đơn đã có.`);
          if (result.issueCount) toast.message(`${result.issueCount} dòng chưa vào sổ. Map SKU ở Nhập đơn sàn.`);
          await queryClient.invalidateQueries({ queryKey: ["orders"] });
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Đang lấy đơn…" : "Lấy đơn ngay"}
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
