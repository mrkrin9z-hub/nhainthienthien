import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pin = z.string().regex(/^\d{4}$/);
const status = z.enum(["chua_lam", "dang_lam", "xong"]);

export const staffPinStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { staffPinReady } = await import("@/server/service");
  return staffPinReady();
});

export const loadPhoneTasks = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ pin }).parse(data))
  .handler(async ({ data }) => {
    const { phoneChecklist } = await import("@/server/service");
    return phoneChecklist(data.pin);
  });

export const savePhoneTaskStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ pin, taskId: z.string().min(3).max(40), status, note: z.string().max(400).optional() }).parse(data))
  .handler(async ({ data }) => {
    const { phoneSetChecklistStatus } = await import("@/server/service");
    await phoneSetChecklistStatus(data);
    return { ok: true };
  });

export const loadPhoneOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ pin, token: z.string().regex(/^[a-f0-9]{32}$/) }).parse(data))
  .handler(async ({ data }) => {
    const { phoneOrderCard } = await import("@/server/service");
    return phoneOrderCard(data.pin, data.token);
  });
