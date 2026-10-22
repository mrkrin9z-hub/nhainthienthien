import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Landmark } from "lucide-react";

import { PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { vnMonth } from "@/domain/calc";
import { formatVnd } from "@/lib/brand";
import { getMe, getMoneyDesk, handCashIn } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/chuyen-nop")({
  component: HandoverPage,
});

function HandoverPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale nộp tiền.">
      <HandoverBody />
    </RoleGate>
  );
}

function HandoverBody() {
  const month = vnMonth();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const desk = useQuery({ queryKey: ["money", month], queryFn: () => getMoneyDesk({ data: { month } }) });
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const owner = me.data?.role === "owner";
  const holders = (desk.data?.holders ?? []).filter((row) => row.staffId !== "ket" && row.tien_mat > 0);
  const mine = desk.data?.me?.tien_mat ?? holders.find((row) => row.staffId === me.data?.id)?.tien_mat ?? 0;
  const [staffId, setStaffId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function start() {
    const held = owner ? (holders[0]?.tien_mat ?? 0) : mine;
    setStaffId(owner ? (holders[0]?.staffId ?? "") : "");
    setAmount(held > 0 ? String(held) : "");
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <PageToolbar
        title="Chuyển nộp"
        hint={owner ? "Nộp tiền mặt nhân viên đang giữ vào két tiệm." : "Nộp tiền mặt đang giữ của bạn vào két tiệm."}
        actions={<ToolbarButton label="Chuyển nộp" icon={Landmark} primary onClick={start} />}
      />
      {owner ? (
        <ul className="divide-y overflow-hidden rounded-md border bg-card">
          {holders.map((row) => (
            <li key={row.staffId} className="flex items-center justify-between px-3 py-3">
              <span className="font-semibold">{row.name}</span>
              <span>{formatVnd(row.tien_mat)}</span>
            </li>
          ))}
          {desk.data && holders.length === 0 ? <li className="px-3 py-3 text-sm text-muted-foreground">Không còn tiền mặt đang giữ.</li> : null}
        </ul>
      ) : (
        <p className="rounded-md border bg-card px-3 py-3 text-sm">Đang giữ {formatVnd(mine)}.</p>
      )}
      {owner && (desk.data?.handovers ?? []).length > 0 ? (
        <section className="rounded-md border bg-card p-3">
          <h2 className="font-semibold">Lần nộp gần đây</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {desk.data?.handovers.slice(0, 8).map((row) => (
              <li key={row.id}>
                {row.fromName}: {formatVnd(row.amount)}
                {row.note ? ` · ${row.note}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chuyển nộp tiền mặt</DialogTitle>
          </DialogHeader>
          {owner ? (
            <label className="text-sm font-semibold">
              Người nộp
              <select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" aria-label="Người nộp" value={staffId} onChange={(event) => setStaffId(event.target.value)}>
                {holders.map((row) => (
                  <option key={row.staffId} value={row.staffId}>
                    {row.name} · {formatVnd(row.tien_mat)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">Đang giữ {formatVnd(mine)}.</p>
          )}
          <label className="text-sm font-semibold">
            Số tiền nộp
            <Input className="mt-1 min-h-11" inputMode="numeric" aria-label="Số tiền nộp" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="text-sm font-semibold">
            Ghi chú
            <Input className="mt-1 min-h-11" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Cuối ca" />
          </label>
          <DialogFooter>
            <Button
              className="min-h-11"
              disabled={busy || !Number(amount)}
              onClick={async () => {
                setBusy(true);
                try {
                  await handCashIn({ data: { amount: Number(amount), note, ...(owner && staffId ? { staffId } : {}) } });
                  toast.success("Đã nộp tiền mặt vào két");
                  setOpen(false);
                  await queryClient.invalidateQueries({ queryKey: ["money"] });
                  await queryClient.invalidateQueries({ queryKey: ["collect"] });
                } catch (error) {
                  toast.error((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Nộp tiền mặt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
