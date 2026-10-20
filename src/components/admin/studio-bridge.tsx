import { ExternalLink } from "lucide-react";

import { studioManageUrl, type StudioBridge } from "@/admin-os/bridges";
import { Button } from "@/components/ui/button";

const PHASE_LABEL: Record<number, string> = {
  2: "Phase 2 — Nhân sự / đơn / SP",
  3: "Phase 3 — Tài chính",
  4: "Phase 4 — Mở rộng",
};

/** Màn skeleton: giữ chỗ trong menu, deep-link StudioBase khi API partner chưa cover. */
export function StudioBridgePanel({ bridge }: { bridge: StudioBridge }) {
  const href = studioManageUrl(bridge.managePath);
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-card p-5">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{PHASE_LABEL[bridge.phase]}</p>
      <h1 className="text-2xl font-extrabold text-primary">{bridge.label}</h1>
      <p className="text-sm text-muted-foreground">{bridge.blurb}</p>
      <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
        Module này đang <strong>kết nối vận hành StudioBase</strong>. App Thiên Thiên giữ đủ chỗ trên menu; cấu hình sâu (OAuth kênh, quyền,
        SePay…) mở trên Manage cho đến khi Partner API cover.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <a href={href} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Mở trên StudioBase
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Path Manage: <code className="rounded bg-muted px-1">{bridge.managePath}</code>
      </p>
      <p className="text-xs text-muted-foreground">
        Tính năng xưởng đã có sẵn (Chat, đơn, QR gửi ảnh, album, ví, kho…) vẫn dùng trong app — không phụ thuộc màn này.
      </p>
    </div>
  );
}
