import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { blankPickup, type CarrierPickup } from "@/domain/carriers";
import { getCarrierDesk, getIntegrations, getMe, pullCatalog, pullMarketplace, saveCarrierPickup, saveIntegration } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/ket-noi")({
  component: ConnectPage,
});


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
    if (drive === "thieu") toast.error("Chưa có Client ID / secret Google — mở phần cấu hình nâng cao để lưu một lần");
    if (drive === "tu-choi") toast.error("Google chưa cấp quyền Drive");
    if (drive === "loi") toast.error("Không kết nối được Google Drive");
    const meta = new URLSearchParams(window.location.search).get("meta");
    if (meta === "ok") toast.success("Đã kết nối Fanpage Thiên Thiên");
    if (meta === "chon") toast.message("Chọn Fanpage vừa cấp quyền");
    if (meta === "thieu") toast.error("Chưa có App Meta — mở cấu hình nâng cao hoặc đặt META_APP_ID / META_APP_SECRET trên Worker");
    if (meta === "tu-choi") toast.error("Facebook chưa cấp quyền page");
    if (meta === "khong-page") toast.error("Tài khoản Facebook không có Fanpage nào");
    if (meta === "loi") toast.error("Không kết nối được Fanpage");
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
        Drive và Fanpage: bấm nút Kết nối để Google/Facebook cấp quyền. Cấu hình App (Client ID, Meta App) chỉ mở khi thiếu.
      </p>
      <DriveCard
        clientSaved={Boolean(status.data?.google_client_id)}
        secretSaved={Boolean(status.data?.google_client_secret)}
        connected={Boolean(status.data?.google_drive)}
      />
      <FanpageCard pageSaved={Boolean(status.data?.meta_page || status.data?.meta)} />
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
      <CarrierCards status={status.data} />
    </div>
  );
}

function FanpageCard({ pageSaved }: { pageSaved: boolean }) {
  const queryClient = useQueryClient();
  const meta = useQuery({
    queryKey: ["meta-connect"],
    queryFn: async () => {
      const { metaConnectStatus } = await import("@/lib/chat.functions");
      return metaConnectStatus();
    },
  });
  const [origin, setOrigin] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const webhook = `${origin}/api/public/meta-webhook`;
  const oauthReady = Boolean(meta.data?.oauthReady);
  const pending = meta.data?.pendingPages ?? [];
  const connected = Boolean(meta.data?.connected || pageSaved);

  return (
    <section className="glass-card space-y-3 rounded-3xl p-4">
      <h2 className="font-bold text-primary">Fanpage Nhà In (Messenger)</h2>
      <p className="text-xs text-muted-foreground">
        Bấm nút bên dưới để đăng nhập Facebook và chọn page của Nhà In. App Meta mượn quyền đã cấp sẵn (không đăng ký Dev App mới) — inbox lưu local, không lấy tin từ studiobase.vn.
      </p>
      <p className="text-sm font-semibold">
        {connected
          ? `Đã nối: ${meta.data?.pageName || "Fanpage"} ${meta.data?.pageId ? `(${meta.data.pageId})` : ""}`
          : "Chưa nối Fanpage — Chat vẫn dùng hội thoại nội bộ."}
      </p>
      {pending.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-semibold text-primary">Chọn Fanpage vừa cấp quyền</p>
          {pending.map((page) => (
            <Button
              key={page.id}
              type="button"
              className="min-h-11 w-full justify-start"
              disabled={picking === page.id}
              onClick={async () => {
                setPicking(page.id);
                try {
                  const { chooseShopMetaPage } = await import("@/lib/chat.functions");
                  const result = await chooseShopMetaPage({ data: { pageId: page.id } });
                  toast.success(`Đã nối ${result.pageName}`);
                  await queryClient.invalidateQueries({ queryKey: ["integrations"] });
                  await queryClient.invalidateQueries({ queryKey: ["meta-connect"] });
                  await queryClient.invalidateQueries({ queryKey: ["chat-status"] });
                } catch (error) {
                  toast.error((error as Error).message);
                } finally {
                  setPicking(null);
                }
              }}
            >
              {picking === page.id ? "Đang nối…" : page.name}
            </Button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {oauthReady ? (
          <Button asChild className="min-h-12">
            <a href="/api/admin/meta/start">{connected ? "Đổi Fanpage (Facebook)" : "Kết nối Fanpage bằng Facebook"}</a>
          </Button>
        ) : (
          <p className="text-sm text-amber-800">
            Chưa có App Meta để mở Facebook. Mở cấu hình nâng cao bên dưới (một lần) — dùng App ID/Secret đã được StudioBase cấp quyền.
          </p>
        )}
        {connected ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              if (!confirm("Ngắt kết nối Fanpage?")) return;
              try {
                const { disconnectShopMetaPage } = await import("@/lib/chat.functions");
                await disconnectShopMetaPage();
                toast.success("Đã ngắt Fanpage");
                await queryClient.invalidateQueries({ queryKey: ["integrations"] });
                await queryClient.invalidateQueries({ queryKey: ["meta-connect"] });
                await queryClient.invalidateQueries({ queryKey: ["chat-status"] });
              } catch (error) {
                toast.error((error as Error).message);
              }
            }}
          >
            Ngắt Fanpage
          </Button>
        ) : null}
        <Button asChild variant="outline" className="min-h-11">
          <a href="/admin/chat">Mở Chat</a>
        </Button>
      </div>
      <p className="break-all text-xs text-muted-foreground">
        Webhook Callback URL (dán trên Meta cho page Nhà In): {origin ? webhook : "/api/public/meta-webhook"}
      </p>
      <button type="button" className="text-sm font-semibold text-primary underline" onClick={() => setAdvanced((v) => !v)}>
        {advanced ? "Ẩn cấu hình nâng cao" : "Cấu hình nâng cao (App Meta — chỉ khi thiếu)"}
      </button>
      {advanced ? (
        <div className="space-y-3 rounded-2xl border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Chỉ cần khi Worker chưa có META_APP_ID / META_APP_SECRET. Lưu một lần rồi dùng nút Facebook ở trên.
          </p>
          <SecretField
            field={{ id: "meta_app_id", label: "Meta App ID", hint: "App đã được StudioBase cấp quyền." }}
            saved={Boolean(meta.data?.metaAppIdSaved)}
            inputType="text"
          />
          <SecretField
            field={{ id: "meta_app_secret", label: "Meta App Secret", hint: "Không hiện lại sau khi lưu." }}
            saved={Boolean(meta.data?.metaAppSecretSaved)}
          />
        </div>
      ) : null}
    </section>
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
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const redirect = `${origin}/api/admin/drive/callback`;
  const ready = clientSaved && secretSaved;
  return (
    <section className="glass-card space-y-3 rounded-3xl p-4">
      <h2 className="font-bold text-primary">Google Drive</h2>
      <p className="text-xs text-muted-foreground">
        Ảnh khách lên Drive của chủ. Bấm nút để Google cấp quyền — không cần nhập lại Client ID mỗi lần nếu đã lưu.
      </p>
      <p className="text-sm font-semibold">
        {connected ? "Đã kết nối Google Drive." : ready ? "Đã có ứng dụng Google — bấm Kết nối để cấp quyền Drive." : "Chưa cấu hình ứng dụng Google."}
      </p>
      <div className="flex flex-wrap gap-2">
        {connected ? (
          <>
            <Button asChild className="min-h-12" variant="outline">
              <a href="/api/admin/drive/start">Kết nối lại Google Drive</a>
            </Button>
            <DisconnectDrive />
          </>
        ) : ready ? (
          <Button asChild className="min-h-12">
            <a href="/api/admin/drive/start">Kết nối Google Drive</a>
          </Button>
        ) : (
          <p className="text-sm text-amber-800">Mở cấu hình nâng cao để lưu Client ID / secret một lần, rồi bấm Kết nối.</p>
        )}
      </div>
      <button type="button" className="text-sm font-semibold text-primary underline" onClick={() => setAdvanced((v) => !v)}>
        {advanced ? "Ẩn cấu hình nâng cao" : ready ? "Đổi Client ID / secret (nâng cao)" : "Cấu hình nâng cao (Client ID / secret)"}
      </button>
      {advanced ? (
        <div className="space-y-3 rounded-2xl border border-dashed p-3">
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
        </div>
      ) : null}
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
        {steps} Đơn 7 ngày gần nhất tự đổ khi mở trang quản trị, hoặc bấm Lấy đơn. Đơn đã có cùng mã sàn không tạo thêm. Sản phẩm đang bán cũng đổ về: giá TikTok và Shopee trên web theo sàn, giá tại tiệm và Facebook giữ nguyên cho đến khi nhân bản ở bảng giá.
      </p>
      <p className="break-all text-xs text-muted-foreground">Redirect URL: {origin ? `${origin}${redirectPath}` : redirectPath}</p>
      {children}
      <p className="text-sm font-semibold">{connected ? `Đã kết nối ${title}.` : `Chưa kết nối ${title}.`}</p>
      {connected ? (
        <div className="flex flex-wrap gap-2">
          <PullOrders channel={channel} />
          <PullCatalog channel={channel} />
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

function PullCatalog({ channel }: { channel: "tiktok" | "shopee" }) {
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const name = channel === "tiktok" ? "TikTok" : "Shopee";
  return (
    <Button
      type="button"
      variant="outline"
      className="min-h-11"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const result = await pullCatalog({ data: { channel } });
          const extra = result.more ? " Còn trang sau, bấm lại để lấy tiếp." : "";
          toast.success(`Đã lấy ${name}: ${result.created} mã mới, ${result.priced} giá cập nhật.${extra}`);
          if (result.skipped.length) toast.message(result.skipped[0] ?? "");
          await queryClient.invalidateQueries({ queryKey: ["prices"] });
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Đang lấy sản phẩm…" : "Lấy sản phẩm về web"}
    </Button>
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

function CarrierCards({
  status,
}: {
  status?: {
    ghn_token?: boolean;
    ghn_shop_id?: boolean;
    ghtk_token?: boolean;
    ghtk_partner?: boolean;
    jt_api_account?: boolean;
    jt_private_key?: boolean;
    jt_customer_code?: boolean;
    jt_password?: boolean;
  };
}) {
  return (
    <section className="glass-card space-y-3 rounded-3xl p-4">
      <h2 className="font-bold text-primary">Nhà vận chuyển</h2>
      <p className="text-xs text-muted-foreground">
        GHN, GHTK và J&T Express. Khóa chỉ được lưu, không hiện lại. Chưa lưu khóa thì không gọi hãng. Tạo vận đơn chỉ khi bấm nút trên đơn, không tự tạo. Đơn TikTok và Shopee giữ vận đơn của sàn.
      </p>
      <PickupForm />
      <SecretField field={{ id: "ghn_token", label: "GHN Token", hint: "Lấy ở developer.ghn.vn, mục quản lý token." }} saved={Boolean(status?.ghn_token)} />
      <SecretField field={{ id: "ghn_shop_id", label: "GHN Shop ID", hint: "Số ShopId của shop GHN." }} saved={Boolean(status?.ghn_shop_id)} inputType="text" />
      <SecretField field={{ id: "ghtk_token", label: "GHTK Token", hint: "Lấy ở trang cấu hình API của GHTK." }} saved={Boolean(status?.ghtk_token)} />
      <SecretField field={{ id: "ghtk_partner", label: "GHTK mã đối tác", hint: "Mã gửi ở header X-Client-Source." }} saved={Boolean(status?.ghtk_partner)} inputType="text" />
      <SecretField field={{ id: "jt_api_account", label: "J&T apiAccount", hint: "Tài khoản trên open.jtexpress.vn." }} saved={Boolean(status?.jt_api_account)} inputType="text" />
      <SecretField field={{ id: "jt_private_key", label: "J&T private key", hint: "Khóa ký. Không hiện lại sau khi lưu." }} saved={Boolean(status?.jt_private_key)} />
      <SecretField field={{ id: "jt_customer_code", label: "J&T customer code", hint: "Mã khách do bưu cục cấp." }} saved={Boolean(status?.jt_customer_code)} inputType="text" />
      <SecretField field={{ id: "jt_password", label: "J&T mật khẩu", hint: "Mật khẩu thường của mã khách. App tự băm khi gọi." }} saved={Boolean(status?.jt_password)} />
    </section>
  );
}

function PickupForm() {
  const desk = useQuery({ queryKey: ["carrier-desk"], queryFn: () => getCarrierDesk() });
  const queryClient = useQueryClient();
  const [pickup, setPickup] = useState<CarrierPickup>(blankPickup());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (desk.data && !ready) {
      setPickup(desk.data.pickup);
      setReady(true);
    }
  }, [desk.data, ready]);
  function set(key: keyof CarrierPickup, value: string) {
    setPickup((current) => ({ ...current, [key]: value }));
  }
  return (
    <form
      className="space-y-2"
      onSubmit={async (event) => {
        event.preventDefault();
        try {
          await saveCarrierPickup({ data: pickup });
          toast.success("Đã lưu địa chỉ lấy hàng");
          await queryClient.invalidateQueries({ queryKey: ["carrier-desk"] });
        } catch (error) {
          toast.error((error as Error).message);
        }
      }}
    >
      <p className="text-sm font-semibold">Địa chỉ lấy hàng</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input id="pickup-name" className="min-h-12" placeholder="Tên người gửi" value={pickup.name} onChange={(event) => set("name", event.target.value)} />
        <Input id="pickup-phone" className="min-h-12" placeholder="Số điện thoại lấy hàng" value={pickup.phone} onChange={(event) => set("phone", event.target.value)} />
        <Input id="pickup-province" className="min-h-12" placeholder="Tỉnh/thành" value={pickup.province} onChange={(event) => set("province", event.target.value)} />
        <Input id="pickup-district" className="min-h-12" placeholder="Quận/huyện, bỏ trống nếu địa chỉ 2 cấp" value={pickup.district} onChange={(event) => set("district", event.target.value)} />
        <Input id="pickup-ward" className="min-h-12" placeholder="Phường/xã" value={pickup.ward} onChange={(event) => set("ward", event.target.value)} />
      </div>
      <Input id="pickup-address" className="min-h-12" placeholder="Địa chỉ lấy hàng" value={pickup.address} onChange={(event) => set("address", event.target.value)} />
      <Button type="submit" variant="outline" className="min-h-11">
        Lưu địa chỉ lấy hàng
      </Button>
    </form>
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
        await queryClient.invalidateQueries({ queryKey: ["meta-connect"] });
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
