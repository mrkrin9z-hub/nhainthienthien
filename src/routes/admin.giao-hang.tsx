import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/giao-hang")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/don-hang", search: { status: "all", q: "" } });
  },
});
