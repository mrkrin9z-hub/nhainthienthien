import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/staff/file/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { readStaffId } = await import("@/server/session");
        const { currentActor, fileForStaff } = await import("@/server/service");
        const person = await currentActor(await readStaffId());
        if (!person) return new Response("Chưa đăng nhập", { status: 401 });
        const file = await fileForStaff(person, params.id);
        if (file.redirect) return Response.redirect(file.redirect, 302);
        const bytes = file.bytes ?? new Uint8Array();
        return new Response(Buffer.from(bytes), {
          headers: {
            "content-type": file.mime || "application/octet-stream",
            "content-disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
          },
        });
      },
    },
  },
});
