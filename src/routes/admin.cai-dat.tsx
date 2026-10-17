import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleGate } from "@/components/role-gate";
import { dueFiles, loadSettings, removeFile, runRecalc, storeSettings, storeStaff } from "@/lib/admin.functions";
import { ROLE_LABEL, type Role } from "@/domain/types";

export const Route = createFileRoute("/admin/cai-dat")({
  component: SettingsPage,
});

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
  const data = settings.data;
  const values = draft ?? (data ? Object.fromEntries(NUMBER_FIELDS.map((field) => {
    const raw = (data.settings as Record<string, unknown>)[field.key];
    return [field.key, raw === null || raw === undefined ? "" : String(raw)];
  })) : null);

  if (settings.isError) return <p className="font-semibold text-destructive">{(settings.error as Error).message}</p>;
  if (!data || !values) return <p className="text-muted-foreground">Đang tải cài đặt…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-primary">Cài đặt</h1>
      <section className="glass-card space-y-3 rounded-3xl p-4">
        <h2 className="font-bold text-primary">Số liệu</h2>
        <p className="text-sm text-muted-foreground">Để trống ô nào được phép trống thì hệ thống không tự bịa số.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {NUMBER_FIELDS.map((field) => (
            <label key={field.key} className="text-sm font-semibold">
              {field.label}
              <Input
                className="mt-1 min-h-11"
                value={values[field.key] ?? ""}
                placeholder={field.nullable ? "Chưa có" : ""}
                onChange={(e) => setDraft({ ...values, [field.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <label className="block text-sm font-semibold">
          Zalo
          <Input className="mt-1 min-h-11" defaultValue={data.settings.zaloPhone} id="zalo" />
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" id="showZalo" defaultChecked={data.settings.showZalo !== false} /> Hiện số Zalo trên web
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
            await storeSettings({ data: patch });
            await runRecalc();
            toast.success("Đã lưu cài đặt và tính lại định mức");
            setDraft(null);
            await queryClient.invalidateQueries({ queryKey: ["settings"] });
          }}
        >
          Lưu cài đặt
        </Button>
      </section>

      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Tài khoản</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {data.staff.map((person) => (
            <li key={person.id}>
              {person.name} · {person.email} · {ROLE_LABEL[person.role as Role]}
              {person.probation ? " · thử việc" : ""}
            </li>
          ))}
        </ul>
        <StaffForm />
      </section>

      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Ảnh đến hạn xóa</h2>
        <p className="text-sm text-muted-foreground">Web chỉ liệt kê. Chủ bấm xóa, không tự xóa im lặng.</p>
        <ul className="mt-2 space-y-2 text-sm">
          {(files.data ?? []).map((file) => (
            <li key={file.fileId} className="flex items-center justify-between gap-2">
              <span>
                {file.orderCode} · {file.name} · {file.ageDays} ngày
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
          {files.data && files.data.length === 0 ? <li>Chưa có file đến hạn.</li> : null}
        </ul>
      </section>

      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Nhật ký sửa</h2>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {data.audits.map((item) => (
            <li key={item.id}>
              {new Date(item.at).toLocaleString("vi-VN")} · {item.actorName || "Hệ thống"} · {item.action}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StaffForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("sale");
  const [password, setPassword] = useState("");
  return (
    <form
      className="mt-4 grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        await storeStaff({ data: { name, email, role, password } });
        toast.success("Đã tạo tài khoản");
        setName("");
        setEmail("");
        setPassword("");
        await queryClient.invalidateQueries({ queryKey: ["settings"] });
      }}
    >
      <Label>Tên</Label>
      <Input className="min-h-11" value={name} onChange={(e) => setName(e.target.value)} required />
      <Label>Email</Label>
      <Input className="min-h-11" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Label>Vai trò</Label>
      <select className="min-h-11 rounded-xl border bg-background px-3" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        <option value="owner">Chủ</option>
        <option value="sale">Sale</option>
        <option value="production">Sản xuất</option>
      </select>
      <Label>Mật khẩu tạm</Label>
      <Input className="min-h-11" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <Button type="submit" className="min-h-11">
        Tạo tài khoản
      </Button>
    </form>
  );
}
