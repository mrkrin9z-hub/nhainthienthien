import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const orderId = String(form.get("orderId") ?? "");
        const accessToken = String(form.get("accessToken") ?? "");
        const fileId = String(form.get("fileId") ?? "");
        const file = form.get("file");
        if (!(file instanceof File) || !orderId || !accessToken || !fileId) {
          return new Response("Thiếu ảnh hoặc mã đơn.", { status: 400 });
        }
        const { saveDirectUpload } = await import("@/server/service");
        await saveDirectUpload({
          orderId,
          accessToken,
          fileId,
          bytes: new Uint8Array(await file.arrayBuffer()),
          mime: file.type || "image/jpeg",
        });
        return Response.json({ ok: true });
      },
    },
  },
});
