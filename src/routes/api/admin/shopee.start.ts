import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/shopee/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const go = (location: string) => new Response(null, { status: 302, headers: { location } });
        const back = (reason: string) => go(`${origin}/admin/ket-noi?shopee=${reason}`);
        const { readStaffId } = await import("@/server/session");
        const { currentActor } = await import("@/server/service");
        const { shopeeStartUrl } = await import("@/server/marketplace-sync");
        const actor = await currentActor(await readStaffId());
        if (!actor || actor.role !== "owner" || actor.mustChangePassword) return back("loi");
        try {
          return go(await shopeeStartUrl(`${origin}/api/admin/shopee/callback`));
        } catch (error) {
          return back(error instanceof Error && error.message === "thieu" ? "thieu" : "loi");
        }
      },
    },
  },
});
