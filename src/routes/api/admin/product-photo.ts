import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/admin/product-photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readStaffId } = await import("@/server/session");
        const { currentActor, saveGroupPhoto } = await import("@/server/service");
        const actor = await currentActor(await readStaffId());
        if (!actor) return new Response("Chưa đăng nhập.", { status: 401 });
        if (actor.mustChangePassword) return new Response("Đổi mật khẩu trước khi dùng.", { status: 403 });
        if (actor.role !== "owner" && actor.role !== "sale") return new Response("Chỉ chủ và sale đổi ảnh.", { status: 403 });
        const form = await request.formData();
        const slug = String(form.get("slug") ?? "");
        const file = form.get("file");
        if (!(file instanceof File) || !slug) return new Response("Thiếu ảnh.", { status: 400 });
        try {
          await saveGroupPhoto(actor, slug, new Uint8Array(await file.arrayBuffer()), file.type || "image/jpeg");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không lưu được ảnh.";
          return new Response(message, { status: 400 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
