import { ExternalLink } from "lucide-react";

import { STUDIOBASE_CHAT_ORIGIN, studioManageUrl, type StudioBridge } from "@/admin-os/bridges";
import { Button } from "@/components/ui/button";

/** Deep-link StudioBase Chat / Manage cho phần OAuth & tin mẫu. */
export function StudioBridgePanel({ bridge }: { bridge: StudioBridge }) {
  const manageHref = studioManageUrl(bridge.managePath);
  const chatHref = STUDIOBASE_CHAT_ORIGIN;
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-card p-5">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">StudioBase Chat</p>
      <h1 className="text-2xl font-extrabold text-primary">{bridge.label}</h1>
      <p className="text-sm text-muted-foreground">{bridge.blurb}</p>
      <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
        Tin mẫu và nối Fanpage/Zalo cấu hình trên <strong>StudioBase</strong>. Inbox trong app Thiên Thiên dùng Partner API (menu Chat).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <a href={manageHref} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Tin mẫu / kênh (Manage)
          </a>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <a href={chatHref} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Mở chat.studiobase
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Path: <code className="rounded bg-muted px-1">{bridge.managePath}</code>
      </p>
    </div>
  );
}
