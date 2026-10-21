import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/staff/file/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { readStaffId } = await import("@/server/session");
        const { currentActor, fileForStaff } = await import("@/server/service");
        const person = await currentActor(await readStaffId());
        if (!person) return new Response("Chưa đăng nhập", { status: 401 });
        const url = new URL(request.url);
        const preview = url.searchParams.get("thumb") === "1" ? (url.searchParams.get("view") === "1" ? 1600 : 480) : null;
        const download = url.searchParams.get("dl") === "1";
        let file;
        try {
          file = await fileForStaff(person, params.id, preview);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thấy file.";
          return new Response(message, { status: preview ? 404 : 400 });
        }
        if (file.redirect) return Response.redirect(file.redirect, 302);
        const { contentDisposition, servedMime } = await import("@/domain/images");
        const bytes = file.bytes ?? new Uint8Array();
        if (preview) {
          return new Response(Buffer.from(bytes), {
            headers: {
              "content-type": servedMime(file.mime || "image/jpeg"),
              "cache-control": "private, max-age=300",
              "x-content-type-options": "nosniff",
            },
          });
        }
        return new Response(Buffer.from(bytes), {
          headers: {
            "content-type": servedMime(file.mime || ""),
            "content-disposition": contentDisposition(file.name, download),
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
