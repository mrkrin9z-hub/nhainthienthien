import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/san-pham")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/gia" });
  },
});
