import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/drive/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const go = (location: string) => new Response(null, { status: 302, headers: { location } });
        const back = (reason: string) => go(`${origin}/admin/ket-noi?drive=${reason}`);
        const { readStaffId, sessionConfig } = await import("@/server/session");
        const { currentActor } = await import("@/server/service");
        const { readIntegrationSecret } = await import("@/server/secrets");
        const { googleAuthUrl, signDriveState } = await import("@/domain/drive-oauth");
        const actor = await currentActor(await readStaffId());
        if (!actor || actor.role !== "owner" || actor.mustChangePassword) return back("loi");
        const clientId = (await readIntegrationSecret("google_client_id")).trim();
        const clientSecret = (await readIntegrationSecret("google_client_secret")).trim();
        if (!clientId || !clientSecret) return back("thieu");
        const state = await signDriveState(actor.id, sessionConfig().password);
        return go(googleAuthUrl({ clientId, redirectUri: `${origin}/api/admin/drive/callback`, state }));
      },
    },
  },
});
