import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/media-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        const fileName = String(form.get("fileName") ?? (file instanceof File ? file.name : "")).trim();
        const pathRaw = String(form.get("path") ?? "[]");
        let path: string[] = [];
        try {
          const parsed = JSON.parse(pathRaw) as unknown;
          if (Array.isArray(parsed)) path = parsed.map((part) => String(part)).slice(0, 8);
        } catch {
          path = [];
        }
        if (!(file instanceof File) || !fileName) {
          return new Response("Thiếu file media.", { status: 400 });
        }
        try {
          const { saveLocalMediaUpload } = await import("@/server/media-library");
          const saved = await saveLocalMediaUpload({
            fileName,
            mimeType: file.type || "application/octet-stream",
            bytes: new Uint8Array(await file.arrayBuffer()),
            path,
          });
          return Response.json(saved);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Không lưu được media.";
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
