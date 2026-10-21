import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/album")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const albumId = String(form.get("albumId") ?? "");
        const phone = String(form.get("phone") ?? "");
        const fileId = String(form.get("fileId") ?? "");
        const file = form.get("file");
        if (!(file instanceof File) || !albumId || !phone || !fileId) {
          return new Response("Thiếu ảnh hoặc số điện thoại.", { status: 400 });
        }
        const { saveAlbumUpload } = await import("@/server/service");
        try {
          await saveAlbumUpload({
            albumId,
            phone,
            fileId,
            bytes: new Uint8Array(await file.arrayBuffer()),
            mime: file.type || "image/jpeg",
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không lưu được ảnh.";
          return new Response(message, { status: 400 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
