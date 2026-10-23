import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMaybe } from "@/lib/brand";
import { getTargets, storeSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/muc-tieu")({
  component: TargetsPage,
});

function TargetsPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <TargetsBody />
    </RoleGate>
  );
}

function TargetsBody() {
  const queryClient = useQueryClient();
  const targets = useQuery({ queryKey: ["targets"], queryFn: () => getTargets() });
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<string[]>(["", "", "", ""]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open && targets.data?.kpiTargets) {
      setValues(targets.data.kpiTargets.map((n) => String(n ?? "")));
    }
  }, [targets.data, open]);

  const labels = targets.data?.labels ?? ["Tháng mở cửa", "Tháng 2", "Tháng 3", "Từ tháng 4"];

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Mục tiêu KPI"
        hint="Mốc doanh thu theo tháng kể từ ngày mở cửa. KPI sale và hoa hồng dùng các số này."
        actions={
          <Link to="/admin/kpi" className="text-sm font-semibold text-primary">
            Xem KPI →
          </Link>
        }
      />
      {targets.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {targets.data ? (
        <p className="rounded-md border bg-card px-4 py-3 text-sm">
          Tháng {targets.data.month}: mục tiêu hiện tại{" "}
          <span className="font-semibold">{formatMaybe(targets.data.currentTarget)}</span>
          {targets.data.shopOpenDate ? (
            <span className="text-muted-foreground"> · mở cửa {targets.data.shopOpenDate}</span>
          ) : null}
        </p>
      ) : null}
      <section className="space-y-3 rounded-md border bg-card p-4">
        <div className="flex justify-end">
          <Button type="button" onClick={() => setOpen(true)}>Sửa</Button>
        </div>
        <dl className="divide-y rounded-md border text-sm">
          {labels.map((label, index) => (
            <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
              <dt>{label}</dt>
              <dd className="font-semibold">{formatMaybe(Number(values[index] || "0"))}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa mục tiêu</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const kpiTargets = values.map((v) => Number(v.replace(/\D/g, "") || "0"));
              if (kpiTargets.some((n) => !Number.isFinite(n) || n < 0)) {
                toast.error("Mốc KPI không hợp lệ.");
                return;
              }
              setSaving(true);
              try {
                await storeSettings({ data: { kpiTargets } });
                toast.success("Đã lưu mục tiêu");
                setOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["targets"] });
                await queryClient.invalidateQueries({ queryKey: ["settings"] });
                await queryClient.invalidateQueries({ queryKey: ["kpi"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {labels.map((label, index) => (
              <div key={label}>
                <Label htmlFor={`target-${index}`}>{label}</Label>
                <Input
                  id={`target-${index}`}
                  className="mt-1 min-h-11"
                  inputMode="numeric"
                  value={values[index] ?? ""}
                  onChange={(e) => {
                    const next = [...values];
                    next[index] = e.target.value.replace(/[^\d]/g, "");
                    setValues(next);
                  }}
                />
              </div>
            ))}
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Đang lưu…" : "Lưu mục tiêu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
