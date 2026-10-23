import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/staff-photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const pin = String(form.get("pin") ?? "");
        const taskId = String(form.get("taskId") ?? "");
        const token = String(form.get("token") ?? "");
        const step = String(form.get("step") ?? "");
        const file = form.get("file");
        if (!(file instanceof File) || !/^\d{4}$/.test(pin) || (!taskId && !token)) {
          return new Response("Thiếu ảnh hoặc mã.", { status: 400 });
        }
        const { saveStaffPhoto } = await import("@/server/service");
        try {
          const saved = await saveStaffPhoto({
            pin,
            ...(taskId ? { taskId } : {}),
            ...(token ? { token, step } : {}),
            name: file.name || "anh.jpg",
            mime: file.type || "image/jpeg",
            bytes: new Uint8Array(await file.arrayBuffer()),
          });
          return Response.json(saved);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không lưu được ảnh.";
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});