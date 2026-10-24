import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { getMe } from "@/lib/admin.functions";

const DashboardPage = lazy(() => import("@/components/admin/dashboard-page").then((mod) => ({ default: mod.DashboardPage })));

function DashboardGate() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (!me.data) return null;
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  );
}

export const Route = createFileRoute("/admin/")({
  component: DashboardGate,
});
