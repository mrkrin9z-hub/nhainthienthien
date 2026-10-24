import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { getMe } from "@/lib/admin.functions";

const PricePage = lazy(() => import("@/components/admin/price-page").then((mod) => ({ default: mod.PricePage })));

function PriceGate() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (!me.data) return null;
  return (
    <Suspense fallback={null}>
      <PricePage />
    </Suspense>
  );
}

export const Route = createFileRoute("/admin/gia")({
  component: PriceGate,
});
