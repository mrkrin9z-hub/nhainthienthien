import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/product-photo/$slug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { publicProductPhoto } = await import("@/server/service");
        const photo = await publicProductPhoto(params.slug);
        if (!photo) return new Response("Chưa có ảnh.", { status: 404 });
        return new Response(photo.bytes, {
          headers: {
            "content-type": photo.mime,
            "cache-control": "public, max-age=60",
          },
        });
      },
    },
  },
});
