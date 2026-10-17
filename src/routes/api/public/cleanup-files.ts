import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cleanup-files")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { readState } = await import("@/server/store");
        const state = await readState();
        const now = Date.now();
        let due = 0;
        for (const order of state.orders) {
          for (const file of order.files) {
            if (file.deletedAt || file.status !== "complete") continue;
            const age = (now - new Date(file.createdAt).getTime()) / 86400000;
            const limit = file.kind === "packing_video" ? state.settings.videoRetentionDays : state.settings.fileRetentionDays;
            if (age >= limit) due += 1;
          }
        }
        return Response.json({
          deleted: 0,
          due,
          note: "Không tự xóa. Chủ xem danh sách và bấm xóa trong Quản trị → Cài đặt.",
        });
      },
    },
  },
});
