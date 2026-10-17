import { useSession } from "@tanstack/react-start/server";

export function sessionConfig() {
  const password = process.env.AUTH_SECRET || "nhainthienthien-dev-auth-secret-key";
  return {
    password,
    name: "tt_staff",
    maxAge: 60 * 60 * 24 * 14,
    cookie: {
      httpOnly: true,
      path: "/",
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV !== "development",
    },
  };
}

export async function readStaffId(): Promise<string | null> {
  const session = await useSession<{ staffId: string }>(sessionConfig());
  return session.data.staffId ?? null;
}

export async function writeStaffId(staffId: string | null): Promise<void> {
  const session = await useSession<{ staffId: string }>(sessionConfig());
  if (!staffId) await session.clear();
  else await session.update({ staffId });
}
