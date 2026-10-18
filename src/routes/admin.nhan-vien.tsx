import { createFileRoute, Link } from "@tanstack/react-router";

import { StaffDesk } from "@/components/admin/staff-desk";
import { RoleGate } from "@/components/role-gate";

export const Route = createFileRoute("/admin/nhan-vien")({
  component: StaffPage,
});

function StaffPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Nhân sự</h1>
          <p className="text-sm text-muted-foreground">Tạo tài khoản, phân quyền, chấm công và lương.</p>
        </div>
        <div className="flex gap-1">
          <span className="inline-flex h-8 items-center rounded-md bg-sidebar-accent px-2.5 text-[13px] text-sidebar-accent-foreground">Nhân viên</span>
          <Link to="/admin/cham-cong" className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-muted">
            Chấm công
          </Link>
          <Link to="/admin/luong" className="inline-flex h-8 items-center rounded-md px-2.5 text-[13px] text-muted-foreground hover:bg-muted">
            Bảng lương
          </Link>
        </div>
        <StaffDesk />
      </div>
    </RoleGate>
  );
}
