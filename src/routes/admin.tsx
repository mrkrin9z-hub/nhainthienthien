import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin/admin-shell";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Quản trị — Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminShell,
});
