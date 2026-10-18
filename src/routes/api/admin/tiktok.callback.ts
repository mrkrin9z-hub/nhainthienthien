import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/tiktok/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const back = (reason: string) => new Response(null, { status: 302, headers: { location: `${origin}/admin/ket-noi?tiktok=${reason}` } });
        if (url.searchParams.get("error")) return back("tu-choi");
        const code = url.searchParams.get("code") ?? "";
        const state = url.searchParams.get("state") ?? "";
        if (!code || !state) return back("loi");
        const { readStaffId, sessionConfig } = await import("@/server/session");
        const { currentActor } = await import("@/server/service");
        const { readDriveState } = await import("@/domain/drive-oauth");
        const { connectTiktok } = await import("@/server/marketplace-sync");
        const actor = await currentActor(await readStaffId());
        if (!actor || actor.role !== "owner" || actor.mustChangePassword) return back("loi");
        const staffId = await readDriveState(state, sessionConfig().password);
        if (!staffId || staffId !== actor.id) return back("loi");
        try {
          await connectTiktok(actor, code);
        } catch (error) {
          return back(error instanceof Error && error.message === "thieu" ? "thieu" : "loi");
        }
        return back("ok");
      },
    },
  },
});
