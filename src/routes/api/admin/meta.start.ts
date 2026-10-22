import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/meta/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const go = (location: string) => new Response(null, { status: 302, headers: { location } });
        const back = (reason: string) => go(`${origin}/admin/ket-noi?meta=${reason}`);
        const { readStaffId, sessionConfig } = await import("@/server/session");
        const { currentActor } = await import("@/server/service");
        const { resolveMetaAppCredentials } = await import("@/server/meta-oauth");
        const { metaAuthUrl, signMetaState } = await import("@/domain/meta-oauth");
        const actor = await currentActor(await readStaffId());
        if (!actor || actor.role !== "owner" || actor.mustChangePassword) return back("loi");
        const creds = await resolveMetaAppCredentials();
        if (!creds.appId || !creds.appSecret) return back("thieu");
        const state = await signMetaState(actor.id, sessionConfig().password);
        return go(
          metaAuthUrl({
            appId: creds.appId,
            redirectUri: `${origin}/api/admin/meta/callback`,
            state,
          }),
        );
      },
    },
  },
});
