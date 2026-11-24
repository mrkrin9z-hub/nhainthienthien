import { createFileRoute, redirect } from "@tanstack/react-router";

/** Thu tiền đã gom trong chi tiết đơn hàng — không còn trang riêng. */
export const Route = createFileRoute("/admin/thu")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/don-hang", search: { status: "can_lam", q: "" } });
  },
  component: () => null,
});
