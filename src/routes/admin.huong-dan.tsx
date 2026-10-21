import { createFileRoute } from "@tanstack/react-router";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { PRINT_GUIDE_SECTIONS } from "@/domain/org-desk";

export const Route = createFileRoute("/admin/huong-dan")({
  component: GuidePage,
});

function GuidePage() {
  return (
    <RoleGate allow={["owner", "sale", "production"]} deny="Cần đăng nhập.">
      <div className="space-y-4">
        <PageToolbar title="Hướng dẫn" hint="Vận hành xưởng in Thiên Thiên — tóm tắt nhanh cho team." />
        <ol className="space-y-3">
          {PRINT_GUIDE_SECTIONS.map((section, index) => (
            <li key={section.title} className="rounded-md border bg-card px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">Bước {index + 1}</p>
              <h2 className="mt-0.5 font-semibold">{section.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{section.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </RoleGate>
  );
}
