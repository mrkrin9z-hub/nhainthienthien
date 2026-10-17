import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAttendance, getMe, grantLeave, punchClock } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/cham-cong")({
  component: ClockPage,
});

function monthNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

function ClockPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [month, setMonth] = useState(monthNow());
  const queryClient = useQueryClient();
  const sheet = useQuery({ queryKey: ["attendance", month], queryFn: () => getAttendance({ data: { month } }) });
  const owner = me.data?.role === "owner";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Chấm công</h1>
      <p className="text-sm text-muted-foreground">
        Ca {sheet.data?.workStart ?? "08:00"}–{sheet.data?.workEnd ?? "18:00"}. Ngày nghỉ tuần:{" "}
        {(sheet.data?.weeklyOff ?? []).length === 0 ? "chưa đặt (JD ghi làm hằng ngày, chủ sửa trong Cài đặt)." : sheet.data?.weeklyOff.join(", ")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="min-h-14 flex-1 bg-accent text-accent-foreground text-base"
          onClick={async () => {
            await punchClock({ data: { action: "in" } });
            toast.success("Đã vào ca");
            await queryClient.invalidateQueries({ queryKey: ["attendance"] });
          }}
        >
          Vào ca
        </Button>
        <Button
          className="min-h-14 flex-1 text-base"
          variant="outline"
          onClick={async () => {
            await punchClock({ data: { action: "out" } });
            toast.success("Đã ra ca");
            await queryClient.invalidateQueries({ queryKey: ["attendance"] });
          }}
        >
          Ra ca
        </Button>
      </div>
      <Input className="min-h-12 max-w-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      {(sheet.data?.people ?? []).map((person) => (
        <section key={person.id} className="glass-card rounded-3xl p-4">
          <h2 className="font-bold text-primary">{person.name}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {person.punches.map((punch) => (
              <PunchRow key={punch.id} punch={punch} owner={owner} />
            ))}
            {person.punches.length === 0 ? <li className="text-muted-foreground">Chưa có lần bấm trong tháng.</li> : null}
          </ul>
          {owner ? (
            <LeaveForm
              staffId={person.id}
              onDone={async () => {
                await queryClient.invalidateQueries({ queryKey: ["attendance"] });
              }}
            />
          ) : null}
        </section>
      ))}
    </div>
  );
}

function PunchRow({
  punch,
  owner,
}: {
  punch: { id: string; inAt: string; outAt: string | null; lateMinutes: number; earlyMinutes: number; note: string };
  owner: boolean;
}) {
  const queryClient = useQueryClient();
  const [inAt, setInAt] = useState(punch.inAt.slice(0, 16));
  const [outAt, setOutAt] = useState(punch.outAt ? punch.outAt.slice(0, 16) : "");
  return (
    <li className="rounded-2xl bg-background p-3">
      <p className="break-words">
        Vào {new Date(punch.inAt).toLocaleString("vi-VN")}
        {punch.outAt ? ` · Ra ${new Date(punch.outAt).toLocaleString("vi-VN")}` : " · đang trong ca"}
      </p>
      <p className="text-muted-foreground">
        Trễ {punch.lateMinutes} phút · Về sớm {punch.earlyMinutes} phút
      </p>
      {owner ? (
        <div className="mt-2 grid grid-cols-1 gap-2">
          <Input className="h-12 w-full min-w-0" type="datetime-local" value={inAt} onChange={(e) => setInAt(e.target.value)} />
          <Input className="h-12 w-full min-w-0" type="datetime-local" value={outAt} onChange={(e) => setOutAt(e.target.value)} />
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { correctPunch } = await import("@/lib/admin.functions");
              await correctPunch({
                data: {
                  punchId: punch.id,
                  inAt: new Date(inAt).toISOString(),
                  outAt: outAt ? new Date(outAt).toISOString() : null,
                  note: "Chủ sửa",
                },
              });
              toast.success("Đã sửa giờ");
              await queryClient.invalidateQueries({ queryKey: ["attendance"] });
            }}
          >
            Sửa
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function LeaveForm({ staffId, onDone }: { staffId: string; onDone: () => Promise<void> }) {
  const [date, setDate] = useState("");
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:flex">
      <Input className="h-12 w-full sm:w-auto" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button
        variant="outline"
        className="min-h-11"
        onClick={async () => {
          await grantLeave({ data: { staffId, date, note: "Nghỉ có phép" } });
          toast.success("Đã ghi ngày nghỉ");
          await onDone();
        }}
      >
        Nghỉ có phép
      </Button>
    </div>
  );
}
