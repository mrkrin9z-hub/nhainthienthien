import { createFileRoute, redirect } from "@tanstack/react-router";

/** Alias cũ /orders/:id (mã hoặc UUID) → trang chi tiết /admin/don-hang/:code. */
export const Route = createFileRoute("/orders/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/don-hang/$code",
      params: { code: params.id },
    });
  },
});
