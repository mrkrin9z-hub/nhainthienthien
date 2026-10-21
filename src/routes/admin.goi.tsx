import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import { studioManageUrl } from "@/admin-os/bridges";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_FEATURES } from "@/domain/org-desk";

export const Route = createFileRoute("/admin/goi")({
  component: SubscriptionPage,
});

function SubscriptionPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <div className="space-y-4">
        <PageToolbar
          title="Gói dịch vụ"
          hint="Những gì xưởng in đã có trong app Thiên Thiên, và phần thanh toán / OAuth vẫn nằm trên StudioBase."
          actions={
            <Button type="button" asChild className="min-h-9">
              <a href={studioManageUrl("/manage/subscription")} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Gói trên StudioBase
              </a>
            </Button>
          }
        />
        <ul className="space-y-2">
          {SUBSCRIPTION_FEATURES.map((row) => (
            <li key={row.title} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-card px-4 py-3">
              <div>
                <p className="font-semibold">{row.title}</p>
                <p className="text-sm text-muted-foreground">{row.body}</p>
              </div>
              <Badge variant={row.local ? "default" : "secondary"}>{row.local ? "Trong app" : "StudioBase"}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </RoleGate>
  );
}
