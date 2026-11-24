import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/product-photo/$slug")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { publicProductPhoto } = await import("@/server/service");
        const galleryId = new URL(request.url).searchParams.get("g");
        const photo = await publicProductPhoto(params.slug, galleryId);
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
