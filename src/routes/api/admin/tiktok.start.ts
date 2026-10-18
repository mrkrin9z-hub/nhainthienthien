import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/tiktok/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const go = (location: string) => new Response(null, { status: 302, headers: { location } });
        const back = (reason: string) => go(`${origin}/admin/ket-noi?tiktok=${reason}`);
        const { readStaffId, sessionConfig } = await import("@/server/session");
        const { currentActor } = await import("@/server/service");
        const { signDriveState } = await import("@/domain/drive-oauth");
        const { tiktokStartUrl } = await import("@/server/marketplace-sync");
        const actor = await currentActor(await readStaffId());
        if (!actor || actor.role !== "owner" || actor.mustChangePassword) return back("loi");
        try {
          const state = await signDriveState(actor.id, sessionConfig().password);
          return go(await tiktokStartUrl(state));
        } catch (error) {
          return back(error instanceof Error && error.message === "thieu" ? "thieu" : "loi");
        }
      },
    },
  },
});
