import { createFileRoute, redirect } from "@tanstack/react-router";

/** Bảng giá kênh đã gộp vào Quản lý sản phẩm. */
export const Route = createFileRoute("/admin/gia")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/san-pham", search: { m: undefined } });
  },
  component: () => null,
});
