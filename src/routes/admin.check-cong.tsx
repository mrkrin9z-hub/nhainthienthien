import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { FilterSheet, PageToolbar } from "@/components/admin/page-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { vnMonth } from "@/domain/calc";
import { getAttendance } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/check-cong")({
  component: CheckAttendancePage,
});

function CheckAttendancePage() {
  const [month, setMonth] = useState(vnMonth());
  const [q, setQ] = useState("");
  const [who, setWho] = useState("all");
  const [filters, setFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const sheet = useQuery({ queryKey: ["attendance", month], queryFn: () => getAttendance({ data: { month } }) });
  const everyone = sheet.data?.people ?? [];
  const people = everyone.filter((person) => {
    const late = person.punches.some((punch) => punch.lateMinutes > 0);
    const open = person.punches.some((punch) => !punch.outAt);
    if (who === "open" && !open) return false;
    if (who === "late" && !late) return false;
    const needle = q.trim().toLowerCase();
    return !needle || person.name.toLowerCase().includes(needle);
  });
  const chips: FilterChip[] = [
    { id: "all", label: "Mọi người", count: everyone.length, ...ALL_TONE },
    { id: "open", label: "Đang trong ca", count: everyone.filter((person) => person.punches.some((punch) => !punch.outAt)).length, color: "#059669" },
    { id: "late", label: "Có đi trễ", count: everyone.filter((person) => person.punches.some((punch) => punch.lateMinutes > 0)).length, color: "#DC2626" },
  ];
  const opened = people.find((person) => person.id === openId) ?? everyone.find((person) => person.id === openId) ?? null;

  return (
    <div className="space-y-3">
      <PageToolbar
        title="Check công"
        hint="Xem ca đã bấm. Muốn vào ca hoặc ra ca thì mở mục Chấm công."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên nhân viên…"
        filterCount={who === "all" ? 1 : 2}
        onFilter={() => setFilters(true)}
        actions={
          <Button className="h-9" onClick={() => setOpenId(people[0]?.id ?? everyone[0]?.id ?? null)} disabled={everyone.length === 0}>
            Xem ca
          </Button>
        }
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc công">
        <label className="text-sm font-semibold">
          Tháng
          <Input className="mt-1 min-h-11" type="month" aria-label="Tháng công" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <FilterChips label="Ca" value={who} chips={chips} onChange={setWho} wrap />
      </FilterSheet>
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {people.map((person) => (
          <li key={person.id}>
            <button type="button" className="flex w-full items-center justify-between px-3 py-3 text-left hover:bg-muted/40" onClick={() => setOpenId(person.id)}>
              <span>
                <span className="font-semibold">{person.name}</span>
                <span className="block text-sm text-muted-foreground">{person.punches.length} lượt</span>
              </span>
              <span className="text-sm text-muted-foreground">
                {person.punches.filter((punch) => punch.lateMinutes > 0).length} lần trễ
                {person.punches.some((punch) => !punch.outAt) ? " · đang trong ca" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {sheet.data && people.length === 0 ? <p className="text-sm text-muted-foreground">Không có người khớp.</p> : null}
      <Dialog open={opened !== null} onOpenChange={(next) => { if (!next) setOpenId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{opened?.name ?? "Ca làm"}</DialogTitle>
          </DialogHeader>
          <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {(opened?.punches ?? []).map((punch) => (
              <li key={punch.id} className="rounded-md border px-3 py-2">
                Vào {new Date(punch.inAt).toLocaleString("vi-VN")}
                {punch.outAt ? ` · Ra ${new Date(punch.outAt).toLocaleString("vi-VN")}` : " · đang trong ca"}
                <span className="block text-muted-foreground">Trễ {punch.lateMinutes} phút</span>
              </li>
            ))}
            {opened && opened.punches.length === 0 ? <li className="text-muted-foreground">Chưa có lần bấm trong tháng.</li> : null}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
