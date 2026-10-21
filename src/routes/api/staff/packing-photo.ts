import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/staff/packing-photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readStaffId } = await import("@/server/session");
        const { currentActor, savePackingPhoto } = await import("@/server/service");
        const actor = await currentActor(await readStaffId());
        if (!actor) return new Response("Chưa đăng nhập.", { status: 401 });
        if (actor.mustChangePassword) return new Response("Đổi mật khẩu trước khi dùng.", { status: 403 });
        const form = await request.formData();
        const orderId = String(form.get("orderId") ?? "");
        const file = form.get("file");
        if (!(file instanceof File) || !orderId) return new Response("Thiếu ảnh gói.", { status: 400 });
        try {
          await savePackingPhoto(actor, orderId, new Uint8Array(await file.arrayBuffer()), file.type || "image/jpeg");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không lưu được ảnh gói.";
          return new Response(message, { status: 400 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
