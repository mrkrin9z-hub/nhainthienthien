import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { DEFAULT_ROLE_MODULES, ROLE_RIGHTS_ROWS } from "@/domain/org-desk";
import { ROLE_LABEL, type Role } from "@/domain/types";
import { getOrg, storeRoleModules } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/nhom-quyen")({
  component: RolesPage,
});

function RolesPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <RolesBody />
    </RoleGate>
  );
}

function RolesBody() {
  const queryClient = useQueryClient();
  const org = useQuery({ queryKey: ["org"], queryFn: () => getOrg() });
  const [draft, setDraft] = useState<Record<Role, string>>({ owner: "", sale: "", production: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const rows = org.data?.roleModules ?? DEFAULT_ROLE_MODULES;
    setDraft({
      owner: (rows.find((r) => r.role === "owner")?.modules ?? []).join("\n"),
      sale: (rows.find((r) => r.role === "sale")?.modules ?? []).join("\n"),
      production: (rows.find((r) => r.role === "production")?.modules ?? []).join("\n"),
    });
  }, [org.data]);

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Nhóm quyền"
        hint="Ba vai trò cố định của xưởng in. Ma trận bên dưới là quy tắc nghiệp vụ; danh sách module chỉnh menu theo role (mỗi dòng một path /admin/…)."
      />
      <section className="rounded-md border bg-card p-4" aria-label="Ma trận quyền">
        <h2 className="font-bold">Quyền nghiệp vụ</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3 font-semibold">Việc</th>
                <th className="px-3 py-2 font-semibold">Chủ</th>
                <th className="px-3 py-2 font-semibold">Sale</th>
                <th className="px-3 py-2 font-semibold">Sản xuất</th>
              </tr>
            </thead>
            <tbody>
              {ROLE_RIGHTS_ROWS.map((row) => (
                <tr key={row.job} className="border-b last:border-0">
                  <td className="py-2 pr-3">{row.job}</td>
                  <td className="px-3 py-2">{row.owner ? "Được" : "—"}</td>
                  <td className="px-3 py-2">{row.sale ? "Được" : "—"}</td>
                  <td className="px-3 py-2">{row.production ? "Được" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3 rounded-md border bg-card p-4">
        <h2 className="font-bold">Module menu theo vai</h2>
        <p className="text-sm text-muted-foreground">Lưu ý: API vẫn kiểm tra role cứng. Danh sách này dùng để ghi nhận / đồng bộ menu (chuẩn bị filter sidebar).</p>
        {(["owner", "sale", "production"] as Role[]).map((role) => (
          <div key={role}>
            <label className="text-sm font-medium" htmlFor={`mods-${role}`}>
              {ROLE_LABEL[role]}
            </label>
            <textarea
              id={`mods-${role}`}
              className="mt-1 min-h-28 w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
              value={draft[role]}
              onChange={(e) => setDraft((c) => ({ ...c, [role]: e.target.value }))}
            />
          </div>
        ))}
        <Button
          type="button"
          disabled={saving || org.isLoading}
          onClick={async () => {
            setSaving(true);
            try {
              await storeRoleModules({
                data: {
                  rows: (["owner", "sale", "production"] as Role[]).map((role) => ({
                    role,
                    modules: draft[role]
                      .split(/\n+/)
                      .map((line) => line.trim())
                      .filter(Boolean),
                  })),
                },
              });
              toast.success("Đã lưu nhóm quyền");
              await queryClient.invalidateQueries({ queryKey: ["org"] });
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Đang lưu…" : "Lưu module"}
        </Button>
      </section>
    </div>
  );
}
