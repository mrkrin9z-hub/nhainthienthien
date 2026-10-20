import { createFileRoute, notFound } from "@tanstack/react-router";

import { STUDIO_BRIDGES } from "@/admin-os/bridges";
import { StudioBridgePanel } from "@/components/admin/studio-bridge";

export const Route = createFileRoute("/admin/studio/$slug")({
  component: StudioBridgePage,
});

function StudioBridgePage() {
  const { slug } = Route.useParams();
  const bridge = STUDIO_BRIDGES[slug];
  if (!bridge) throw notFound();
  return <StudioBridgePanel bridge={bridge} />;
}
