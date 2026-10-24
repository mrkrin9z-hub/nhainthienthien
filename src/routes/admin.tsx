import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { AdminLogin } from "@/components/admin/admin-login";
import { getMe } from "@/lib/admin.functions";

const AdminShell = lazy(() => import("@/components/admin/admin-shell").then((mod) => ({ default: mod.AdminShell })));

function AdminEntry() {
  const initialMe = Route.useLoaderData();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe(), initialData: initialMe });
  if (!me.data) {
    return (
      <AdminLogin
        onDone={() => {
          void queryClient.invalidateQueries({ queryKey: ["me"] });
        }}
      />
    );
  }
  return (
    <Suspense fallback={<div className="p-10 text-center text-muted-foreground">Đang tải…</div>}>
      <AdminShell initialMe={me.data} />
    </Suspense>
  );
}

export const Route = createFileRoute("/admin")({
  loader: ({ context }) => context.queryClient.ensureQueryData({ queryKey: ["me"], queryFn: () => getMe() }),
  head: () => ({
    meta: [
      { title: "Quản trị — Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminEntry,
});
