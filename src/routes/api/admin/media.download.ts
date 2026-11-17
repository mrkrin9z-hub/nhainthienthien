import { createFileRoute } from "@tanstack/react-router";

import { contentDisposition } from "@/domain/images";

export const Route = createFileRoute("/api/admin/media/download")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const fileId = (url.searchParams.get("id") || "").trim();
        if (!/^[A-Za-z0-9_-]{8,200}$/.test(fileId)) {
          return new Response("Mã file không đúng.", { status: 400 });
        }
        const { readStaffId } = await import("@/server/session");
        const { currentActor } = await import("@/server/service");
        const person = await currentActor(await readStaffId());
        if (!person || person.mustChangePassword) {
          return new Response("Chưa đăng nhập.", { status: 401 });
        }
        try {
          const { streamMediaFile } = await import("@/server/media-library");
          const file = await streamMediaFile(person, fileId);
          const headers = new Headers({
            "Content-Type": file.mime || "application/octet-stream",
            "Content-Disposition": contentDisposition(file.name, true),
            "Cache-Control": "private, no-store",
          });
          if (file.size > 0) headers.set("Content-Length", String(file.size));
          return new Response(file.body, { status: 200, headers });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không tải được file.";
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
