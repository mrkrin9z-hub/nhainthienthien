import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/shopee/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const back = (reason: string) => new Response(null, { status: 302, headers: { location: `${origin}/admin/ket-noi?shopee=${reason}` } });
        if (url.searchParams.get("error")) return back("tu-choi");
        const code = url.searchParams.get("code") ?? "";
        const shopId = url.searchParams.get("shop_id") ?? "";
        if (!code || !shopId) return back("loi");
        const { readStaffId } = await import("@/server/session");
        const { currentActor } = await import("@/server/service");
        const { connectShopee } = await import("@/server/marketplace-sync");
        const actor = await currentActor(await readStaffId());
        if (!actor || actor.role !== "owner" || actor.mustChangePassword) return back("loi");
        try {
          await connectShopee(actor, code, shopId);
        } catch (error) {
          return back(error instanceof Error && error.message === "thieu" ? "thieu" : "loi");
        }
        return back("ok");
      },
    },
  },
});
