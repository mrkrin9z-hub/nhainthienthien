import { createFileRoute } from "@tanstack/react-router";

import { uploadKeyShape } from "@/domain/order-upload";

export const Route = createFileRoute("/api/public/order-photo/$token/$fileId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!uploadKeyShape(params.token)) return new Response("Không thấy ảnh.", { status: 404 });
        const width = new URL(request.url).searchParams.get("view") === "1" ? 1600 : 480;
        try {
          const { publicOrderPhoto } = await import("@/server/service");
          const photo = await publicOrderPhoto(params.token, params.fileId, width);
          return new Response(photo.bytes, {
            headers: {
              "content-type": photo.mime,
              "cache-control": "private, max-age=300",
              "x-content-type-options": "nosniff",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không thấy ảnh.";
          return new Response(message, { status: 404 });
        }
      },
    },
  },
});
