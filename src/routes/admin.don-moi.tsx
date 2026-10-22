import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/don-moi")({
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/orders/create",
      search: {
        phone: typeof (search as { phone?: string }).phone === "string" ? (search as { phone?: string }).phone : undefined,
        name: typeof (search as { name?: string }).name === "string" ? (search as { name?: string }).name : undefined,
        chat: typeof (search as { chat?: string }).chat === "string" ? (search as { chat?: string }).chat : undefined,
      },
    });
  },
});
