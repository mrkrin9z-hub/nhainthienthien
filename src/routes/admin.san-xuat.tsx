import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { getMe } from "@/lib/admin.functions";

const ProductionPage = lazy(() => import("@/components/admin/production-page").then((mod) => ({ default: mod.ProductionPage })));

function ProductionGate() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (!me.data) return null;
  return (
    <Suspense fallback={null}>
      <ProductionPage />
    </Suspense>
  );
}

export const Route = createFileRoute("/admin/san-xuat")({
  component: ProductionGate,
});
