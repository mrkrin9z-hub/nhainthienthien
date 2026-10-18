import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { canPreviewPhoto, PhotoViewer, staffThumb } from "@/components/photo-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleGate } from "@/components/role-gate";
import { StaffDesk } from "@/components/admin/staff-desk";
import { dueFiles, loadSettings, removeFile, runRecalc, storeSettings } from "@/lib/admin.functions";
import { DEFAULT_REMIND_DAYS, DEFAULT_REMIND_MESSAGE, DEFAULT_REPEAT_ORDERS } from "@/domain/crm";

export const Route = createFileRoute("/admin/cai-dat")({
  component: SettingsPage,
});

const FIELD_GROUPS: { title: string; hint: string; keys: string[] }[] = [
  {
    title: "Giá vốn",
    hint: "Mực, hao hụt và ngưỡng lãi. Ô được phép trống thì để trống — hệ thống không tự bịa số.",
    keys: ["inkPercent", "marginYellowPercent", "marginRedPercent", "wasteRate"],
  },
  {
    title: "Phí sàn",
    hint: "Phí, thuế và hoa hồng theo kênh. Máy tính giá ở Bảng giá dùng các số này.",
    keys: [
      "tiktokFeePercent", "tiktokExtraPercent", "tiktokFixed", "tiktokTaxPercent", "tiktokCommissionPercent", "tiktokAffiliatePercent",
      "shopeeFeePercent", "shopeeExtraPercent", "shopeeInfra", "shopeePiship", "shopeeTaxPercent", "shopeeCommissionPercent", "shopeeAffiliatePercent",
      "fbTaxPercent", "fbCommissionPercent", "fbAdsPercent", "fbCodPercent", "fbShipping",
    ],
  },
  {
    title: "Lương và công",
    hint: "Lương cứng, thử việc, ân hạn và mức trừ. Mức trừ để trống thì chưa trừ.",
    keys: ["walkinCommissionPercent", "saleBase", "saleProbationPercent", "productionBase", "lateDeductionPerMinute", "absenceDeductionPerDay", "lateGraceMinutes"],
  },
  {
    title: "Vận hành",
    hint: "Cọc, hòa vốn, định mức kho và nhắc khách. Chi phí cố định từng tháng sửa ở Báo cáo.",
    keys: ["depositMinTotal", "depositPercent", "breakevenMonth", "breakevenDay", "tapeOrdersPerRoll", "magnetPiecesPerSheet", "fileRetentionDays", "videoRetentionDays", "rentFromJune2027", "repeatCustomerOrders", "remindAfterDays"],
  },
];

const NUMBER_FIELDS: { key: string; label: string; nullable?: boolean }[] = [
  { key: "inkPercent", label: "Mực (% giá bán)" },
  { key: "marginYellowPercent", label: "Ngưỡng vàng lãi gộp (%)" },
  { key: "marginRedPercent", label: "Ngưỡng đỏ (lãi dưới số này là LỖ)" },
  { key: "wasteRate", label: "Hao hụt giấy/màng (0.1 = 10%)" },
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

function SettingsPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <SettingsBody />
    </RoleGate>
  );
}

function SettingsBody() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => loadSettings() });
  const files = useQuery({ queryKey: ["due-files"], queryFn: () => dueFiles() });
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [tab, setTab] = useState<"so" | "cua" | "tk" | "file">("so");
  const [fileQ, setFileQ] = useState("");
  const [auditQ, setAuditQ] = useState("");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const data = settings.data;
  const due = (files.data ?? []).filter((file) => {
    const needle = fileQ.trim().toLowerCase();
    return !needle || `${file.orderCode} ${file.name}`.toLowerCase().includes(needle);
  });
  const audits = (data?.audits ?? []).filter((item) => {
    const needle = auditQ.trim().toLowerCase();
    return !needle || item.sentence.toLowerCase().includes(needle);
  });
  const fileList = useListPage(due, fileQ);
  const auditList = useListPage(audits, auditQ);
  const values = draft ?? (data ? Object.fromEntries(NUMBER_FIELDS.map((field) => {
    const raw = (data.settings as Record<string, unknown>)[field.key];
    if (raw === null || raw === undefined) {
      if (field.key === "repeatCustomerOrders") return [field.key, String(DEFAULT_REPEAT_ORDERS)];
      if (field.key === "remindAfterDays") return [field.key, String(DEFAULT_REMIND_DAYS)];
      return [field.key, ""];
    }
    return [field.key, String(raw)];
  })) : null);

  if (settings.isError) return <p className="font-semibold text-destructive">{(settings.error as Error).message}</p>;
  if (!data || !values) return <p className="text-muted-foreground">Đang tải cài đặt…</p>;

  const tabs = [
    { id: "so" as const, label: "Số liệu" },
    { id: "cua" as const, label: "Cửa hàng" },
    { id: "tk" as const, label: "Người dùng & quyền" },
    { id: "file" as const, label: "Ảnh và nhật ký" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Cài đặt</h1>
        <p className="mt-1 text-sm text-muted-foreground">Số phí, giờ làm, sản phẩm đang hiện và tài khoản. Lưu một lần cho tab Số liệu và Cửa hàng.</p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none" role="tablist" aria-label="Mục cài đặt">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-semibold ${tab === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={tab === "so" ? "space-y-4" : "hidden"}>
        {FIELD_GROUPS.map((group) => (
          <section key={group.title} className="space-y-3 rounded-2xl border border-border/70 bg-card p-4">
            <h2 className="font-semibold text-primary">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.hint}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {group.keys.map((key) => {
                const field = NUMBER_FIELDS.find((item) => item.key === key);
                if (!field) return null;
                return (
                  <label key={field.key} className="text-sm font-semibold">
                    {field.label}
                    <Input
                      className="mt-1 min-h-11"
                      value={values[field.key] ?? ""}
                      placeholder={field.nullable ? "Chưa có" : ""}
                      onChange={(e) => setDraft({ ...values, [field.key]: e.target.value })}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <section className={tab === "cua" ? "space-y-3 rounded-2xl border border-border/70 bg-card p-4" : "hidden"}>
        <label className="block text-sm font-semibold">
          Zalo
          <Input className="mt-1 min-h-11" defaultValue={data.settings.zaloPhone} id="zalo" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" id="showZalo" defaultChecked={data.settings.showZalo === true} /> Hiện số Zalo trên web
        </label>
        <label className="block text-sm font-semibold">
          Giờ mở cửa (hiện trên web)
          <Input className="mt-1 min-h-11" defaultValue={data.settings.publicHours} id="hours" />
        </label>
        <label className="block text-sm font-semibold">
          Giờ vào ca
          <Input className="mt-1 min-h-11" defaultValue={data.settings.workStart} id="workStart" />
        </label>
        <label className="block text-sm font-semibold">
          Giờ ra ca
          <Input className="mt-1 min-h-11" defaultValue={data.settings.workEnd} id="workEnd" />
        </label>
        <label className="block text-sm font-semibold">
          Ngày nghỉ trong tuần (0=CN … 6=T7, cách nhau bởi dấu phẩy). Để trống = làm cả tuần.
          <Input className="mt-1 min-h-11" defaultValue={data.settings.weeklyOff.join(",")} id="weeklyOff" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" id="anhThe" defaultChecked={data.settings.showAnhThe} /> Hiện ảnh thẻ trên web
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" id="album" defaultChecked={data.settings.showAlbum} /> Hiện album trên web
        </label>
        <div className="space-y-1">
          {data.groups.map((group) => (
            <label key={group.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" id={`g-${group.id}`} defaultChecked={data.settings.groupListed[group.id] !== false} />
              Hiện {group.name}
            </label>
          ))}
        </div>
        <label className="block text-sm font-semibold">
          Cách tính hoa hồng
          <select id="commissionBasis" className="mt-1 min-h-12 w-full rounded-xl border bg-card px-3" defaultValue={data.settings.commissionBasis ?? "shop"}>
            <option value="shop">Toàn tiệm — một sale làm hết</option>
            <option value="handled">Theo đơn người đó xử lý — từ hai sale</option>
          </select>
          <span className="mt-1 block font-normal text-muted-foreground">
            Hoa hồng bậc 3% / 5% / 7% tính một lần trên doanh thu đã thu trong tháng. Đang một sale thì để Toàn tiệm. Nếu hai người cùng xử lý một đơn, chế độ theo đơn tính đơn đó cho cả hai.
          </span>
        </label>
        <label className="block text-sm font-semibold">
          Mẫu tin nhắc khách. Chỗ trống: {"{ten}"} {"{so_don}"} {"{ngay}"} {"{dip}"} {"{so_dt}"}. Không tự gửi.
          <textarea id="remindMessage" className="mt-1 min-h-24 w-full rounded-xl border bg-card px-3 py-2" defaultValue={data.settings.remindMessage || DEFAULT_REMIND_MESSAGE} />
        </label>
      </section>
      {tab === "so" || tab === "cua" ? (
        <Button
          className="min-h-12 bg-accent text-accent-foreground"
          onClick={async () => {
            const patch: Record<string, unknown> = {};
            for (const field of NUMBER_FIELDS) {
              const raw = (values[field.key] ?? "").trim();
              patch[field.key] = raw === "" ? null : Number(raw);
            }
            const read = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
            const checked = (id: string) => (document.getElementById(id) as HTMLInputElement).checked;
            patch.zaloPhone = read("zalo");
            patch.showZalo = checked("showZalo");
            patch.publicHours = read("hours");
            patch.workStart = read("workStart");
            patch.workEnd = read("workEnd");
            patch.weeklyOff = read("weeklyOff")
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
              .map(Number);
            patch.showAnhThe = checked("anhThe");
            patch.showAlbum = checked("album");
            patch.groupListed = Object.fromEntries(data.groups.map((group) => [group.id, checked(`g-${group.id}`)]));
            patch.remindMessage = (document.getElementById("remindMessage") as HTMLTextAreaElement).value;
            patch.commissionBasis = (document.getElementById("commissionBasis") as HTMLSelectElement).value;
            await storeSettings({ data: patch });
            await runRecalc();
            toast.success("Đã lưu cài đặt và tính lại định mức");
            setDraft(null);
            await queryClient.invalidateQueries({ queryKey: ["settings"] });
          }}
        >
          Lưu cài đặt
        </Button>
      ) : null}

      <section className={tab === "tk" ? "space-y-3" : "hidden"}>
        <div>
          <h2 className="text-lg font-bold">Người dùng và quyền</h2>
          <p className="text-sm text-muted-foreground">Mỗi người một vai trò. Bấm dòng để đổi quyền hoặc mật khẩu.</p>
        </div>
        <StaffDesk />
      </section>

      <section className={tab === "file" ? "rounded-2xl border border-border/70 bg-card p-4" : "hidden"}>
        <h2 className="font-semibold text-primary">Ảnh đến hạn xóa</h2>
        <p className="text-sm text-muted-foreground">Web chỉ liệt kê. Chủ bấm xóa, không tự xóa im lặng.</p>
        <Input value={fileQ} onChange={(event) => setFileQ(event.target.value)} placeholder="Tìm mã đơn hoặc tên ảnh…" aria-label="Tìm ảnh đến hạn" className="mt-2 h-11" />
        <div className="mt-2">
          <ListPager page={fileList.page} pages={fileList.pages} total={fileList.total} start={fileList.start} count={fileList.slice.length} noun="ảnh" onPage={fileList.setPage} />
        </div>
        <ul className="mt-2 space-y-2 text-sm">
          {fileList.slice.map((file) => (
            <li key={file.fileId} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                {canPreviewPhoto(file) ? (
                  <button type="button" className="shrink-0 overflow-hidden rounded-xl border border-border" onClick={() => setOpenFile(file.fileId)} aria-label={`Xem ${file.name}`}>
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
                  await queryClient.invalidateQueries({ queryKey: ["due-files"] });
                }}
              >
                Xóa
              </Button>
            </li>
          ))}
          {fileList.total === 0 ? <li>{(files.data ?? []).length === 0 ? "Chưa có file đến hạn." : "Không có ảnh khớp bộ lọc."}</li> : null}
        </ul>
        {openFile ? (
          <PhotoViewer
            src={staffThumb(openFile, true)}
            name={fileList.slice.find((file) => file.fileId === openFile)?.name ?? "Ảnh"}
            downloadHref={`/api/staff/file/${openFile}`}
            onClose={() => setOpenFile(null)}
          />
        ) : null}
      </section>

      <section className={tab === "file" ? "rounded-2xl border border-border/70 bg-card p-4" : "hidden"}>
        <h2 className="font-semibold text-primary">Nhật ký sửa</h2>
        <Input value={auditQ} onChange={(event) => setAuditQ(event.target.value)} placeholder="Tìm nội dung sửa…" aria-label="Tìm nhật ký sửa" className="mt-2 h-11" />
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
