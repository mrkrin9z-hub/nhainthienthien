import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ADMIN_MODULE_GROUPS } from "@/admin-os/modules";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { DEFAULT_ROLE_MODULES, ROLE_RIGHTS_ROWS } from "@/domain/org-desk";
import { ROLE_LABEL, type Role } from "@/domain/types";
import { getOrg, storeRoleModules } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/nhom-quyen")({
  component: RolesPage,
});

const ROLES: Role[] = ["owner", "sale", "production"];

function allMenuItems() {
  return ADMIN_MODULE_GROUPS.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title || "Chung" })));
}

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
  const menu = useMemo(() => allMenuItems(), []);
  const [draft, setDraft] = useState<Record<Role, Set<string>>>({
    owner: new Set(),
    sale: new Set(),
    production: new Set(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const rows = org.data?.roleModules ?? DEFAULT_ROLE_MODULES;
    setDraft({
      owner: new Set(rows.find((r) => r.role === "owner")?.modules ?? []),
      sale: new Set(rows.find((r) => r.role === "sale")?.modules ?? []),
      production: new Set(rows.find((r) => r.role === "production")?.modules ?? []),
    });
  }, [org.data]);

  function toggle(role: Role, path: string) {
    setDraft((current) => {
      const next = new Set(current[role]);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      if (path !== "/admin") next.add("/admin");
      return { ...current, [role]: next };
    });
  }

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Nhóm quyền"
        hint="Tick module hiện trên menu theo vai. API vẫn chặn theo role cứng (owner/sale/production)."
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
        <h2 className="font-bold">Menu theo vai</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-3 font-semibold">Module</th>
                {ROLES.map((role) => (
                  <th key={role} className="px-2 py-2 font-semibold">
                    {ROLE_LABEL[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {menu.map((item) => (
                <tr key={item.to} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <span className="font-medium">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {item.group} · {item.to}
                    </span>
                  </td>
                  {ROLES.map((role) => {
                    const allowedByRole = item.roles.includes(role);
                    return (
                      <td key={role} className="px-2 py-2">
                        <input
                          type="checkbox"
                          disabled={!allowedByRole || item.to === "/admin"}
                          checked={draft[role].has(item.to)}
                          onChange={() => toggle(role, item.to)}
                          aria-label={`${ROLE_LABEL[role]} · ${item.label}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          type="button"
          disabled={saving || org.isLoading}
          onClick={async () => {
            setSaving(true);
            try {
              await storeRoleModules({
                data: {
                  rows: ROLES.map((role) => ({
                    role,
                    modules: [...draft[role]],
                  })),
                },
              });
              toast.success("Đã lưu nhóm quyền — menu áp dụng ngay lần tải sau");
              await queryClient.invalidateQueries({ queryKey: ["org"] });
              await queryClient.invalidateQueries({ queryKey: ["me"] });
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Đang lưu…" : "Lưu menu theo vai"}
        </Button>
      </section>
    </div>
  );
}
