import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { StaffLinks } from "@/components/admin/sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vnMonth } from "@/domain/calc";
import { getAttendance, getMe, grantLeave, punchClock } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/cham-cong")({
  component: ClockPage,
});

function monthNow() {
  return vnMonth();
}

function ClockPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [month, setMonth] = useState(monthNow());
  const [q, setQ] = useState("");
  const [who, setWho] = useState("all");
  const queryClient = useQueryClient();
  const sheet = useQuery({ queryKey: ["attendance", month], queryFn: () => getAttendance({ data: { month } }) });
  const owner = me.data?.role === "owner";

  const everyone = sheet.data?.people ?? [];
  const people = everyone.filter((person) => {
    const late = person.punches.some((punch) => punch.lateMinutes > 0);
    const open = person.punches.some((punch) => !punch.outAt);
    if (who === "open" && !open) return false;
    if (who === "late" && !late) return false;
    const needle = q.trim().toLowerCase();
    return !needle || person.name.toLowerCase().includes(needle);
  });
  const whoChips: FilterChip[] = [
    { id: "all", label: "Mọi người", count: everyone.length, ...ALL_TONE },
    { id: "open", label: "Đang trong ca", count: everyone.filter((person) => person.punches.some((punch) => !punch.outAt)).length, color: "#059669" },
    { id: "late", label: "Có đi trễ", count: everyone.filter((person) => person.punches.some((punch) => punch.lateMinutes > 0)).length, color: "#DC2626" },
  ];
  const list = useListPage(people, `${month}|${q}|${who}`);
  const punches = everyone.flatMap((person) => person.punches);
  const openCount = punches.filter((punch) => !punch.outAt).length;
  const lateCount = punches.filter((punch) => punch.lateMinutes > 0).length;
  const leaves = sheet.data?.leaves ?? [];

  return (
    <div className="space-y-4">
      <StaffLinks />
      <PageToolbar title="Chấm công" search={q} onSearch={setQ} searchPlaceholder="Tìm tên nhân viên…" />
      <FilterChips label="Ca làm" value={who} chips={whoChips} onChange={setWho} />
      <div>
        <p className="mt-1 text-sm text-muted-foreground">
          Ca {sheet.data?.workStart ?? "08:00"}–{sheet.data?.workEnd ?? "18:00"}. Ngày nghỉ tuần:{" "}
          {(sheet.data?.weeklyOff ?? []).length === 0 ? "chưa đặt (hợp đồng ghi làm hằng ngày, chủ sửa trong Cài đặt)." : sheet.data?.weeklyOff.join(", ")}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Summary label="Lượt bấm" value={String(punches.length)} />
        <Summary label="Đang trong ca" value={String(openCount)} />
        <Summary label="Lượt đi trễ" value={String(lateCount)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="min-h-14 flex-1 bg-accent text-accent-foreground text-base"
          onClick={async () => {
            await punchClock({ data: { action: "in" } });
            toast.success("Đã vào ca");
            await queryClient.invalidateQueries({ queryKey: ["attendance"] });
            await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
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
            await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          }}
        >
          Ra ca
        </Button>
      </div>
      <Input className="min-h-12 max-w-xs" type="month" aria-label="Tháng chấm công" value={month} onChange={(e) => setMonth(e.target.value)} />
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="người" onPage={list.setPage} />
      {list.slice.map((person) => {
        const mine = leaves.filter((leave) => leave.staffId === person.id);
        return (
        <section key={person.id} className="rounded-2xl border border-border/70 bg-card p-4">
          <h2 className="font-semibold text-primary">{person.name}</h2>
          <p className="text-sm text-muted-foreground">
            {person.punches.length} lượt · {person.punches.filter((punch) => punch.lateMinutes > 0).length} lần trễ
            {person.punches.some((punch) => !punch.outAt) ? " · đang trong ca" : ""}
          </p>
          {mine.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {mine.map((leave) => (
                <li key={leave.id} className="rounded-xl bg-muted px-3 py-2">
                  Nghỉ {leave.date}{leave.note ? ` · ${leave.note}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <PunchList punches={person.punches} owner={owner} />
          {owner ? (
            <LeaveForm
              staffId={person.id}
              onDone={async () => {
                await queryClient.invalidateQueries({ queryKey: ["attendance"] });
              }}
            />
          ) : null}
        </section>
        );
      })}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold text-primary">{value}</p>
    </div>
  );
}

function PunchList({
  punches,
  owner,
}: {
  punches: { id: string; inAt: string; outAt: string | null; lateMinutes: number; earlyMinutes: number; note: string }[];
  owner: boolean;
}) {
  const list = useListPage(punches, String(punches.length));
  if (punches.length === 0) return <p className="mt-2 text-sm text-muted-foreground">Chưa có lần bấm trong tháng.</p>;
  return (
    <div className="mt-2 space-y-2">
      <ul className="space-y-2 text-sm">
        {list.slice.map((punch) => (
          <PunchRow key={punch.id} punch={punch} owner={owner} />
        ))}
      </ul>
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="lượt" onPage={list.setPage} />
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
