import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/staff/task-photo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readStaffId } = await import("@/server/session");
        const { currentActor, saveActorTaskPhoto } = await import("@/server/service");
        const person = await currentActor(await readStaffId());
        if (!person) return new Response("Chưa đăng nhập", { status: 401 });
        const form = await request.formData();
        const taskId = String(form.get("taskId") ?? "");
        const file = form.get("file");
        if (!(file instanceof File) || taskId.length < 3) return new Response("Thiếu ảnh hoặc việc.", { status: 400 });
        try {
          const saved = await saveActorTaskPhoto(person, {
            taskId,
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