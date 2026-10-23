import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  CloudUpload,
  HardDrive,
  KeyRound,
  Layers,
  Receipt,
  Settings2,
  Store,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { parseSettingsPanel, SETTINGS_HUB_GROUPS, type SettingsHubCard, type SettingsPanel } from "@/admin-os/settings-hub";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { canPreviewPhoto, PhotoViewer, staffThumb } from "@/components/photo-thumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleGate } from "@/components/role-gate";
import { StaffDesk } from "@/components/admin/staff-desk";
import { DEFAULT_REMIND_DAYS, DEFAULT_REMIND_MESSAGE, DEFAULT_REPEAT_ORDERS } from "@/domain/crm";
import { normalizeShopChannels } from "@/domain/org-desk";
import { TRANSFER_BANKS } from "@/domain/print-shop";
import { CHANNEL_LABEL, CHANNELS, type Channel } from "@/domain/types";
import { dueFiles, loadSettings, removeFile, runRecalc, storeSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/cai-dat")({
  validateSearch: (search: Record<string, unknown>) => ({
    m: parseSettingsPanel(search.m) ?? undefined,
  }),
  component: SettingsPage,
});

const COST_KEYS = ["inkPercent", "marginYellowPercent", "marginRedPercent", "wasteRate", "wasteAlertPercent"] as const;
const FEE_KEYS = [
  "tiktokFeePercent",
  "tiktokExtraPercent",
  "tiktokFixed",
  "tiktokTaxPercent",
  "tiktokCommissionPercent",
  "tiktokAffiliatePercent",
  "shopeeFeePercent",
  "shopeeExtraPercent",
  "shopeeInfra",
  "shopeePiship",
  "shopeeTaxPercent",
  "shopeeCommissionPercent",
  "shopeeAffiliatePercent",
  "fbTaxPercent",
  "fbCommissionPercent",
  "fbAdsPercent",
  "fbCodPercent",
  "fbShipping",
] as const;
const SALARY_KEYS = [
  "walkinCommissionPercent",
  "saleBase",
  "saleProbationPercent",
  "productionBase",
  "moHomeLaborPercent",
  "lateDeductionPerMinute",
  "absenceDeductionPerDay",
  "lateGraceMinutes",
] as const;
const OPS_KEYS = [
  "depositMinTotal",
  "depositPercent",
  "breakevenMonth",
  "breakevenDay",
  "tapeOrdersPerRoll",
  "magnetPiecesPerSheet",
  "fileRetentionDays",
  "videoRetentionDays",
  "rentFromJune2027",
  "repeatCustomerOrders",
  "remindAfterDays",
] as const;

const NUMBER_FIELDS: { key: string; label: string; nullable?: boolean }[] = [
  { key: "inkPercent", label: "Mực (% giá bán)" },
  { key: "marginYellowPercent", label: "Ngưỡng vàng lãi gộp (%)" },
  { key: "marginRedPercent", label: "Ngưỡng đỏ (lãi dưới số này là LỖ)" },
  { key: "wasteRate", label: "Hao hụt giấy/màng (0.1 = 10%)" },
  { key: "wasteAlertPercent", label: "Cảnh báo khi hao hụt vượt % doanh thu", nullable: true },
  { key: "tiktokFeePercent", label: "TikTok phí %" },
  { key: "tiktokExtraPercent", label: "TikTok phí thêm %" },
  { key: "tiktokFixed", label: "TikTok phí/đơn" },
  { key: "tiktokTaxPercent", label: "TikTok thuế %" },
  { key: "tiktokCommissionPercent", label: "TikTok hoa hồng sale %" },
  { key: "tiktokAffiliatePercent", label: "TikTok affiliate %" },
  { key: "shopeeFeePercent", label: "Shopee phí %" },
  { key: "shopeeExtraPercent", label: "Shopee phí thêm %" },
  { key: "shopeeInfra", label: "Shopee hạ tầng" },
  { key: "shopeePiship", label: "Shopee PiShip" },
  { key: "shopeeTaxPercent", label: "Shopee thuế %" },
  { key: "shopeeCommissionPercent", label: "Shopee hoa hồng %" },
  { key: "shopeeAffiliatePercent", label: "Shopee affiliate %" },
  { key: "fbTaxPercent", label: "Facebook thuế %" },
  { key: "fbCommissionPercent", label: "Facebook hoa hồng %" },
  { key: "fbAdsPercent", label: "Facebook quảng cáo %" },
  { key: "fbCodPercent", label: "Facebook phí COD %" },
  { key: "fbShipping", label: "Phí ship Facebook", nullable: true },
  { key: "walkinCommissionPercent", label: "Tại tiệm hoa hồng %" },
  { key: "saleBase", label: "Lương cứng sale" },
  { key: "saleProbationPercent", label: "Thử việc sale %" },
  { key: "productionBase", label: "Lương sản xuất" },
  { key: "moHomeLaborPercent", label: "Phần lương sản xuất tính cho Mơ Home %" },
  { key: "lateDeductionPerMinute", label: "Trừ mỗi phút đi trễ", nullable: true },
  { key: "absenceDeductionPerDay", label: "Trừ mỗi ngày vắng", nullable: true },
  { key: "lateGraceMinutes", label: "Ân hạn đi trễ (phút)" },
  { key: "depositMinTotal", label: "Đơn Facebook phải cọc từ" },
  { key: "depositPercent", label: "% cọc" },
  { key: "breakevenMonth", label: "Doanh thu hòa vốn tháng" },
  { key: "breakevenDay", label: "Doanh thu hòa vốn ngày" },
  { key: "tapeOrdersPerRoll", label: "Số đơn / cuộn băng keo" },
  { key: "magnetPiecesPerSheet", label: "Miếng nam châm 6×9 / tấm" },
  { key: "fileRetentionDays", label: "Giữ ảnh khách (ngày)" },
  { key: "videoRetentionDays", label: "Giữ video đóng gói (ngày)" },
  { key: "rentFromJune2027", label: "Mặt bằng từ T6/2027" },
  { key: "repeatCustomerOrders", label: "Khách quay lại từ số đơn" },
  { key: "remindAfterDays", label: "Nhắc khi đơn cuối cách đây (ngày)" },
];

const ICONS: Record<SettingsHubCard["icon"], typeof Store> = {
  store: Store,
  channels: Layers,
  bell: Bell,
  cost: Receipt,
  target: Target,
  wallet: Wallet,
  plug: CloudUpload,
  backup: HardDrive,
  roles: KeyRound,
  salary: Users,
  ops: Settings2,
  files: Building2,
};

function SettingsPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <SettingsBody />
    </RoleGate>
  );
}

function SettingsBody() {
  const { m: panel } = Route.useSearch();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => loadSettings() });
  const files = useQuery({ queryKey: ["due-files"], queryFn: () => dueFiles(), enabled: panel === "tep" });
  const [fileQ, setFileQ] = useState("");
  const [auditQ, setAuditQ] = useState("");
  const [openFile, setOpenFile] = useState<string | null>(null);

  const data = settings.data;
  const values = data
    ? Object.fromEntries(
        NUMBER_FIELDS.map((field) => {
          const raw = (data.settings as Record<string, unknown>)[field.key];
          if (raw === null || raw === undefined) {
            if (field.key === "repeatCustomerOrders") return [field.key, String(DEFAULT_REPEAT_ORDERS)];
            if (field.key === "remindAfterDays") return [field.key, String(DEFAULT_REMIND_DAYS)];
            return [field.key, ""];
          }
          return [field.key, String(raw)];
        }),
      )
    : null;

  if (settings.isError) return <p className="font-semibold text-destructive">{(settings.error as Error).message}</p>;
  if (!data || !values) return <p className="text-muted-foreground">Đang tải cài đặt…</p>;

  const shopChannels = normalizeShopChannels(data.settings.shopChannels);

  async function saveNumbersAndStore(next: Record<string, string>, extra: Record<string, unknown> = {}) {
    const patch: Record<string, unknown> = { ...extra };
    const merged = { ...values, ...next };
    for (const field of NUMBER_FIELDS) {
      const raw = (merged[field.key] ?? "").trim();
      patch[field.key] = raw === "" ? null : Number(raw);
    }
    await storeSettings({ data: patch });
    await runRecalc();
    toast.success("Đã lưu cài đặt");
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
  }

  if (!panel) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Cài đặt hệ thống</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kênh cửa hàng, chi phí, kết nối và quyền — mở từng mục bằng nút truy cập.
          </p>
        </div>
        {SETTINGS_HUB_GROUPS.map((group) => (
          <section key={group.title} className="space-y-3">
            <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{group.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.cards.map((card) => {
                const Icon = ICONS[card.icon] ?? Settings2;
                return (
                  <Link
                    key={card.id}
                    to={card.to}
                    search={card.search}
                    className="flex min-h-[5.5rem] gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition hover:border-primary/40 hover:bg-muted/30"
                  >
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-foreground">{card.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{card.blurb}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const titles: Record<SettingsPanel, string> = {
    "chi-phi": "Cài đặt chi phí",
    "cua-hang": "Thông tin cửa hàng",
    kenh: "Kênh cửa hàng",
    luong: "Lương và công",
    "van-hanh": "Số liệu vận hành",
    "nguoi-dung": "Người dùng",
    tep: "Ảnh và nhật ký",
  };

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin/cai-dat" className="text-sm text-muted-foreground hover:text-primary">
          ← Cài đặt hệ thống
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold text-primary">{titles[panel]}</h1>
      </div>

      {panel === "chi-phi" ? (
        <div className="space-y-4">
          <NumberGroup
            title="Giá vốn"
            hint="Mực, hao hụt và ngưỡng lãi. Ô được phép trống thì để trống — hệ thống không tự bịa số."
            keys={COST_KEYS}
            values={values}
            onSave={(next) => saveNumbersAndStore(next)}
          />
          <NumberGroup
            title="Phí sàn"
            hint="Phí, thuế và hoa hồng theo kênh. Máy tính giá ở Bảng giá dùng các số này."
            keys={FEE_KEYS}
            values={values}
            onSave={(next) => saveNumbersAndStore(next)}
          />
        </div>
      ) : null}

      {panel === "luong" ? (
        <div className="space-y-4">
          <NumberGroup
            title="Lương và công"
            hint="Lương cứng, thử việc, phần lương sản xuất tính cho Mơ Home, ân hạn và mức trừ. Mức trừ để trống thì chưa trừ."
            keys={SALARY_KEYS}
            values={values}
            onSave={async (next) => {
              const basis = (document.getElementById("commissionBasis") as HTMLSelectElement | null)?.value;
              await saveNumbersAndStore(next, basis ? { commissionBasis: basis } : {});
            }}
            dialogExtra={
              <label className="block text-sm font-semibold">
                Cách tính hoa hồng
                <select id="commissionBasis" className="mt-1 min-h-12 w-full rounded-xl border bg-card px-3" defaultValue={data.settings.commissionBasis ?? "shop"}>
                  <option value="shop">Toàn tiệm — một sale làm hết</option>
                  <option value="handled">Theo đơn người đó xử lý — từ hai sale</option>
                </select>
              </label>
            }
          />
        </div>
      ) : null}

      {panel === "van-hanh" ? (
        <div className="space-y-4">
          <NumberGroup
            title="Vận hành"
            hint="Cọc, hòa vốn, định mức kho và nhắc khách. Chi phí cố định từng tháng sửa ở Báo cáo."
            keys={OPS_KEYS}
            values={values}
            onSave={async (next) => {
              const remind = (document.getElementById("remindMessage") as HTMLTextAreaElement | null)?.value;
              await saveNumbersAndStore(next, remind !== undefined && remind !== null ? { remindMessage: remind } : {});
            }}
            dialogExtra={
              <label className="block text-sm font-semibold">
                Mẫu tin nhắc khách. Chỗ trống: {"{ten}"} {"{so_don}"} {"{ngay}"} {"{dip}"} {"{so_dt}"}. Không tự gửi.
                <textarea id="remindMessage" className="mt-1 min-h-24 w-full rounded-xl border bg-card px-3 py-2" defaultValue={data.settings.remindMessage || DEFAULT_REMIND_MESSAGE} />
              </label>
            }
          />
        </div>
      ) : null}

      {panel === "kenh" ? <ChannelPanel rows={shopChannels} onSaved={async () => { await queryClient.invalidateQueries({ queryKey: ["settings"] }); }} /> : null}

      {panel === "cua-hang" ? (
        <StorePanel
          data={data}
          onSave={async (patch) => {
            await storeSettings({ data: { ...patch, showZalo: false } });
            toast.success("Đã lưu thông tin cửa hàng");
            await queryClient.invalidateQueries({ queryKey: ["settings"] });
          }}
        />
      ) : null}

      {panel === "nguoi-dung" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Mỗi người một vai trò. Bấm dòng để đổi quyền hoặc mật khẩu.</p>
          <StaffDesk />
        </div>
      ) : null}

      {panel === "tep" ? (
        <FilesPanel
          files={files.data ?? []}
          filesLoading={files.isLoading}
          audits={data.audits ?? []}
          fileQ={fileQ}
          auditQ={auditQ}
          openFile={openFile}
          onFileQ={setFileQ}
          onAuditQ={setAuditQ}
          onOpenFile={setOpenFile}
          onRemoved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["due-files"] });
          }}
        />
      ) : null}
    </div>
  );
}

function NumberGroup({
  title,
  hint,
  keys,
  values,
  onSave,
  dialogExtra,
}: {
  title: string;
  hint: string;
  keys: readonly string[];
  values: Record<string, string>;
  onSave: (next: Record<string, string>) => void | Promise<void>;
  dialogExtra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [local, setLocal] = useState(values);
  const [saving, setSaving] = useState(false);
  const rows = keys
    .map((key) => NUMBER_FIELDS.find((item) => item.key === key))
    .filter((field): field is (typeof NUMBER_FIELDS)[number] => Boolean(field))
    .filter((field) => !q.trim() || field.label.toLowerCase().includes(q.trim().toLowerCase()));

  function begin() {
    setLocal(values);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(local);
      setOpen(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-primary">{title}</h2>
        <Button type="button" className="min-h-11" onClick={begin}>Sửa</Button>
      </div>
      <p className="text-sm text-muted-foreground">{hint}</p>
      <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Lọc chỉ số…" aria-label={`Lọc ${title}`} className="h-11 max-w-xs" />
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2">Chỉ số</th>
              <th className="px-3 py-2 text-right">Giá trị</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((field) => (
              <tr key={field.key} className="border-t">
                <td className="px-3 py-2">{field.label}</td>
                <td className="px-3 py-2 text-right font-semibold">{values[field.key] ? values[field.key] : "Chưa có"}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-4 text-center text-muted-foreground">Không khớp.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa {title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {keys.map((key) => {
              const field = NUMBER_FIELDS.find((item) => item.key === key);
              if (!field) return null;
              return (
                <label key={field.key} className="text-sm font-semibold">
                  {field.label}
                  <Input
                    className="mt-1 min-h-11"
                    value={local[field.key] ?? ""}
                    placeholder={field.nullable ? "Chưa có" : ""}
                    onChange={(event) => setLocal({ ...local, [field.key]: event.target.value })}
                  />
                </label>
              );
            })}
            {dialogExtra}
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ChannelPanel({
  rows,
  onSaved,
}: {
  rows: { id: Channel; enabled: boolean; label: string }[];
  onSaved: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(rows);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!local.some((row) => row.enabled)) {
      toast.error("Cần bật ít nhất một kênh cửa hàng.");
      return;
    }
    setSaving(true);
    try {
      await storeSettings({ data: { shopChannels: normalizeShopChannels(local) } });
      toast.success("Đã lưu kênh cửa hàng");
      setOpen(false);
      await onSaved();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-primary">Kênh cửa hàng</h2>
        <Button type="button" className="min-h-11" onClick={() => { setLocal(rows); setOpen(true); }}>Sửa</Button>
      </div>
      <p className="text-sm text-muted-foreground">Kênh bán đang bật. Phải bật ít nhất một kênh. Các kênh cố định: {CHANNELS.join(", ")}.</p>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2">Kênh</th>
              <th className="px-3 py-2">Tên hiển thị</th>
              <th className="px-3 py-2 text-right">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-3 py-2 font-semibold">{CHANNEL_LABEL[row.id]}</td>
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 text-right">{row.enabled ? "Đang bật" : "Tắt"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa kênh cửa hàng</DialogTitle>
          </DialogHeader>
          <ul className="space-y-3">
            {local.map((row) => (
              <li key={row.id} className="rounded-xl border p-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) => setLocal(local.map((item) => (item.id === row.id ? { ...item, enabled: event.target.checked } : item)))}
                  />
                  {CHANNEL_LABEL[row.id]}
                </label>
                <Label className="mt-3 block text-sm">Tên hiển thị</Label>
                <Input
                  className="mt-1 min-h-11"
                  value={row.label}
                  onChange={(event) => setLocal(local.map((item) => (item.id === row.id ? { ...item, label: event.target.value } : item)))}
                />
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : "Lưu kênh cửa hàng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StorePanel({
  data,
  onSave,
}: {
  data: NonNullable<Awaited<ReturnType<typeof loadSettings>>>;
  onSave: (patch: {
    publicHours: string;
    workStart: string;
    workEnd: string;
    weeklyOff: number[];
    showAnhThe: boolean;
    showAlbum: boolean;
    groupListed: Record<string, boolean>;
    bank: { id: string; account: string; holder: string };
    staffPin?: string;
  }) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hours, setHours] = useState(data.settings.publicHours);
  const [workStart, setWorkStart] = useState(data.settings.workStart);
  const [workEnd, setWorkEnd] = useState(data.settings.workEnd);
  const [weeklyOff, setWeeklyOff] = useState(data.settings.weeklyOff.join(","));
  const [anhThe, setAnhThe] = useState(data.settings.showAnhThe);
  const [album, setAlbum] = useState(data.settings.showAlbum);
  const [listed, setListed] = useState<Record<string, boolean>>({});
  const [bankId, setBankId] = useState(data.settings.bank?.id ?? "");
  const [bankAccount, setBankAccount] = useState(data.settings.bank?.account ?? "");
  const [bankHolder, setBankHolder] = useState(data.settings.bank?.holder ?? "");
  const [staffPin, setStaffPin] = useState("");
  const bankName = TRANSFER_BANKS.find((bank) => bank.id === data.settings.bank?.id)?.label ?? "Chưa gắn";

  function begin() {
    setHours(data.settings.publicHours);
    setWorkStart(data.settings.workStart);
    setWorkEnd(data.settings.workEnd);
    setWeeklyOff(data.settings.weeklyOff.join(","));
    setAnhThe(data.settings.showAnhThe);
    setAlbum(data.settings.showAlbum);
    setListed(Object.fromEntries(data.groups.map((group) => [group.id, data.settings.groupListed[group.id] !== false])));
    setBankId(data.settings.bank?.id ?? "");
    setBankAccount(data.settings.bank?.account ?? "");
    setBankHolder(data.settings.bank?.holder ?? "");
    setStaffPin("");
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({
        publicHours: hours,
        workStart,
        workEnd,
        weeklyOff: weeklyOff.split(",").map((part) => part.trim()).filter(Boolean).map(Number),
        showAnhThe: anhThe,
        showAlbum: album,
        groupListed: listed,
        bank: { id: bankId, account: bankAccount, holder: bankHolder },
        ...(staffPin.trim() ? { staffPin: staffPin.trim() } : {}),
      });
      setOpen(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-primary">Thông tin cửa hàng</h2>
        <Button type="button" className="min-h-11" onClick={begin}>Sửa</Button>
      </div>
      <dl className="divide-y rounded-md border text-sm">
        <Info label="Giờ mở cửa" value={data.settings.publicHours || "Chưa có"} />
        <Info label="Giờ ca" value={`${data.settings.workStart} – ${data.settings.workEnd}`} />
        <Info label="Ngày nghỉ" value={data.settings.weeklyOff.length ? data.settings.weeklyOff.join(", ") : "Làm cả tuần"} />
        <Info label="Ảnh thẻ trên web" value={data.settings.showAnhThe ? "Hiện" : "Ẩn"} />
        <Info label="Album trên web" value={data.settings.showAlbum ? "Hiện" : "Ẩn"} />
        {data.groups.map((group) => (
          <Info key={group.id} label={group.name} value={data.settings.groupListed[group.id] === false ? "Ẩn" : "Hiện"} />
        ))}
        <Info label="Ngân hàng" value={bankName} />
        <Info label="Số tài khoản" value={data.settings.bank?.account || "Chưa có"} />
        <Info label="Chủ tài khoản" value={data.settings.bank?.holder || "Chưa có"} />
        <Info label="PIN điện thoại" value={data.settings.staffPinSet ? "Đã đặt 4 số" : "Chưa đặt"} />
      </dl>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa thông tin cửa hàng</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Giờ mở cửa (hiện trên web)
              <Input className="mt-1 min-h-11" value={hours} onChange={(event) => setHours(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Giờ vào ca
              <Input className="mt-1 min-h-11" value={workStart} onChange={(event) => setWorkStart(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Giờ ra ca
              <Input className="mt-1 min-h-11" value={workEnd} onChange={(event) => setWorkEnd(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Mã PIN 4 số cho điện thoại (/q). Để trống nếu giữ mã cũ.
              <Input className="mt-1 min-h-11" inputMode="numeric" autoComplete="off" value={staffPin} onChange={(event) => setStaffPin(event.target.value.replace(/\D/g, "").slice(0, 4))} aria-label="Mã PIN nhân viên" />
            </label>
            <label className="block text-sm font-semibold">
              Ngày nghỉ trong tuần (0=CN … 6=T7, cách nhau bởi dấu phẩy). Để trống = làm cả tuần.
              <Input className="mt-1 min-h-11" value={weeklyOff} onChange={(event) => setWeeklyOff(event.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={anhThe} onChange={(event) => setAnhThe(event.target.checked)} /> Hiện ảnh thẻ trên web
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={album} onChange={(event) => setAlbum(event.target.checked)} /> Hiện album trên web
            </label>
            <div className="space-y-1">
              {data.groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={listed[group.id] !== false}
                    onChange={(event) => setListed({ ...listed, [group.id]: event.target.checked })}
                  />
                  Hiện {group.name}
                </label>
              ))}
            </div>
            <label className="block text-sm font-semibold">
              Ngân hàng nhận chuyển khoản
              <select className="mt-1 min-h-12 w-full rounded-xl border bg-card px-3" value={bankId} onChange={(event) => setBankId(event.target.value)}>
                <option value="">Chưa gắn</option>
                {TRANSFER_BANKS.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Số tài khoản
              <Input className="mt-1 min-h-11" inputMode="numeric" value={bankAccount} onChange={(event) => setBankAccount(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Tên chủ tài khoản
              <Input className="mt-1 min-h-11" value={bankHolder} onChange={(event) => setBankHolder(event.target.value)} />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-11 bg-accent text-accent-foreground" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : "Lưu thông tin cửa hàng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

function FilesPanel({
  files,
  filesLoading,
  audits,
  fileQ,
  auditQ,
  openFile,
  onFileQ,
  onAuditQ,
  onOpenFile,
  onRemoved,
}: {
  files: Awaited<ReturnType<typeof dueFiles>>;
  filesLoading: boolean;
  audits: { id: string; at: string; sentence: string }[];
  fileQ: string;
  auditQ: string;
  openFile: string | null;
  onFileQ: (v: string) => void;
  onAuditQ: (v: string) => void;
  onOpenFile: (v: string | null) => void;
  onRemoved: () => void | Promise<void>;
}) {
  const due = files.filter((file) => {
    const needle = fileQ.trim().toLowerCase();
    return !needle || `${file.orderCode} ${file.name}`.toLowerCase().includes(needle);
  });
  const auditRows = audits.filter((item) => {
    const needle = auditQ.trim().toLowerCase();
    return !needle || item.sentence.toLowerCase().includes(needle);
  });
  const fileList = useListPage(due, fileQ);
  const auditList = useListPage(auditRows, auditQ);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="font-semibold text-primary">Ảnh đến hạn xóa</h2>
        <p className="text-sm text-muted-foreground">Web chỉ liệt kê. Chủ bấm xóa, không tự xóa im lặng.</p>
        {filesLoading ? <p className="mt-2 text-sm text-muted-foreground">Đang tải…</p> : null}
        <Input value={fileQ} onChange={(event) => onFileQ(event.target.value)} placeholder="Tìm mã đơn hoặc tên ảnh…" aria-label="Tìm ảnh đến hạn" className="mt-2 h-11" />
        <div className="mt-2">
          <ListPager page={fileList.page} pages={fileList.pages} total={fileList.total} start={fileList.start} count={fileList.slice.length} noun="ảnh" onPage={fileList.setPage} />
        </div>
        <ul className="mt-2 space-y-2 text-sm">
          {fileList.slice.map((file) => (
            <li key={file.fileId} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                {canPreviewPhoto(file) ? (
                  <button type="button" className="shrink-0 overflow-hidden rounded-xl border border-border" onClick={() => onOpenFile(file.fileId)} aria-label={`Xem ${file.name}`}>
                    <img src={staffThumb(file.fileId)} alt="" className="size-14 object-cover" />
                  </button>
                ) : null}
                <span className="min-w-0 truncate">
                  {file.orderCode} · {file.name} · {file.ageDays} ngày
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await removeFile({ data: { fileId: file.fileId } });
                  toast.success("Đã xóa file");
                  await onRemoved();
                }}
              >
                Xóa
              </Button>
            </li>
          ))}
          {fileList.total === 0 ? <li>{files.length === 0 ? "Chưa có file đến hạn." : "Không có ảnh khớp bộ lọc."}</li> : null}
        </ul>
        {openFile ? (
          <PhotoViewer
            src={staffThumb(openFile, true)}
            name={fileList.slice.find((file) => file.fileId === openFile)?.name ?? "Ảnh"}
            downloadHref={`/api/staff/file/${openFile}`}
            onClose={() => onOpenFile(null)}
          />
        ) : null}
      </section>
      <section className="rounded-2xl border border-border/70 bg-card p-4">
        <h2 className="font-semibold text-primary">Nhật ký sửa</h2>
        <Input value={auditQ} onChange={(event) => onAuditQ(event.target.value)} placeholder="Tìm nội dung sửa…" aria-label="Tìm nhật ký sửa" className="mt-2 h-11" />
        <div className="mt-2">
          <ListPager page={auditList.page} pages={auditList.pages} total={auditList.total} start={auditList.start} count={auditList.slice.length} noun="dòng" onPage={auditList.setPage} />
        </div>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {auditList.slice.map((item) => (
            <li key={item.id}>
              {new Date(item.at).toLocaleString("vi-VN")} · {item.sentence}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
