import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/cleanup-files")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { purgeExpiredFiles } = await import("@/server/service");
        const deleted = await purgeExpiredFiles();
        return Response.json({
          deleted,
          note: "Đã xoá ảnh gốc quá 6 tháng sau khi đơn xong, và video đóng gói quá hạn.",
        });
      },
    },
  },
});
