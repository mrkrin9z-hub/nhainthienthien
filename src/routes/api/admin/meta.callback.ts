import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const back = (reason: string) =>
          new Response(null, { status: 302, headers: { location: `${origin}/admin/ket-noi?meta=${reason}` } });
        if (url.searchParams.get("error")) return back("tu-choi");
        const code = url.searchParams.get("code") ?? "";
        const state = url.searchParams.get("state") ?? "";
        if (!code || !state) return back("loi");
        const { readStaffId, sessionConfig } = await import("@/server/session");
        const { currentActor, connectMetaPage } = await import("@/server/service");
        const { readMetaState } = await import("@/domain/meta-oauth");
        const {
          resolveMetaAppCredentials,
          exchangeMetaCode,
          listMetaPagesForUser,
          saveMetaPendingPages,
          clearMetaPendingPages,
        } = await import("@/server/meta-oauth");
        const actor = await currentActor(await readStaffId());
        if (!actor || actor.role !== "owner" || actor.mustChangePassword) return back("loi");
        const staffId = await readMetaState(state, sessionConfig().password);
        if (!staffId || staffId !== actor.id) return back("loi");
        try {
          const creds = await resolveMetaAppCredentials();
          if (!creds.appId || !creds.appSecret) return back("thieu");
          const userToken = await exchangeMetaCode({
            code,
            redirectUri: `${origin}/api/admin/meta/callback`,
            appId: creds.appId,
            appSecret: creds.appSecret,
          });
          const pages = await listMetaPagesForUser(userToken);
          if (pages.length === 0) return back("khong-page");
          if (pages.length === 1) {
            const only = pages[0]!;
            await clearMetaPendingPages();
            await connectMetaPage(actor, { pageToken: only.accessToken, pageName: only.name });
            return back("ok");
          }
          await saveMetaPendingPages(pages);
          return back("chon");
        } catch {
          return back("loi");
        }
      },
    },
  },
});
