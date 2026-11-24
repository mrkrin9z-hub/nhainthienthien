import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatVnd } from "@/lib/brand";
import {
  getMe,
  getOrders,
  getSePayConfig,
  ignoreBankTxn,
  listBankTxns,
  reconcileBankTxn,
  regenerateSePayKey,
  storeSettings,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/sepay")({
  component: SePayPage,
});

function SePayPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem SePay / Check tiền.">
      <SePayBody />
    </RoleGate>
  );
}

function SePayBody() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const isOwner = me.data?.role === "owner";
  const cfg = useQuery({ queryKey: ["sepay"], queryFn: () => getSePayConfig(), enabled: isOwner });
  const [tab, setTab] = useState<"cai-dat" | "check-tien">(isOwner ? "cai-dat" : "check-tien");

  useEffect(() => {
    if (!isOwner && tab === "cai-dat") setTab("check-tien");
  }, [isOwner, tab]);
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [accountHint, setAccountHint] = useState("");
  const [webhookPath, setWebhookPath] = useState("/api/public/sepay");
  const [note, setNote] = useState("");
  const [autoPay, setAutoPay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (!cfg.data?.sepay) return;
    setEnabled(cfg.data.sepay.enabled);
    setApiKey(cfg.data.sepay.apiKey ?? "");
    setAccountHint(cfg.data.sepay.accountHint);
    setWebhookPath(cfg.data.sepay.webhookPath || "/api/public/sepay");
    setNote(cfg.data.sepay.note);
    setAutoPay(cfg.data.bank?.autoOrderPaymentEnabled === true);
  }, [cfg.data]);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const bank = cfg.data?.bank;
  const sepay = cfg.data?.sepay;
  const webhookUrl = `${origin}${webhookPath.startsWith("/") ? webhookPath : `/${webhookPath}`}`;

  return (
    <div className="space-y-4">
      <PageToolbar
        title="SePay"
        hint="Webhook ngân hàng → sổ phụ Check tiền → mã SB trên đơn → tự thu (nếu bật) hoặc đối soát tay. Không dùng HĐĐT."
      />
      <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card px-1 pt-1 shadow-sm">
        {(isOwner
          ? ([
              ["cai-dat", "Cài đặt"],
              ["check-tien", "Check tiền"],
            ] as const)
          : ([["check-tien", "Check tiền"]] as const)
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${tab === id ? "bg-[#2563eb] text-white" : "text-muted-foreground hover:bg-muted"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "cai-dat" && isOwner ? (
        <>
          {cfg.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
          <div className="space-y-2 rounded-md border bg-card px-4 py-3 text-sm">
            <p>
              Tài khoản nhận CK:{" "}
              {bank ? (
                <span className="font-medium">
                  {bank.holder} · {bank.account}
                </span>
              ) : (
                <span className="text-destructive">chưa cấu hình — vào Cài đặt → Thông tin cửa hàng</span>
              )}
            </p>
            <p>
              URL webhook: <code className="break-all rounded bg-muted px-1 text-xs">{webhookUrl || webhookPath}</code>
            </p>
            <p className="text-muted-foreground">
              Trên my.sepay.vn: tạo Webhook Money in, Auth = <strong>Apikey</strong>, dán key bên dưới, chọn đúng STK đang map.
              Nội dung CK / VietQR dùng mã <code className="rounded bg-muted px-1">SB******</code> gắn đơn.
            </p>
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
              <p>
                Ping gần nhất:{" "}
                <span className="font-medium text-foreground">
                  {sepay?.lastPingAt ? new Date(sepay.lastPingAt).toLocaleString("vi-VN") : "—"}
                </span>
              </p>
              <p>
                Nhận GD gần nhất:{" "}
                <span className="font-medium text-foreground">
                  {sepay?.lastReceivedAt ? new Date(sepay.lastReceivedAt).toLocaleString("vi-VN") : "—"}
                </span>
              </p>
              <p>
                Đã lưu GD: <span className="font-medium text-foreground">{cfg.data?.stats?.storedTxns ?? 0}</span>
                {" · "}
                Chưa khớp: <span className="font-medium text-rose-700">{cfg.data?.stats?.unmatched ?? 0}</span>
              </p>
            </div>
          </div>
          <form
            className="space-y-3 rounded-md border bg-card p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              try {
                await storeSettings({
                  data: {
                    sepay: { enabled, apiKey, accountHint, webhookPath, note },
                    ...(bank
                      ? {
                          bank: {
                            id: bank.id,
                            account: bank.account,
                            holder: bank.holder,
                            autoOrderPaymentEnabled: autoPay,
                          },
                        }
                      : {}),
                  },
                });
                toast.success("Đã lưu SePay");
                await queryClient.invalidateQueries({ queryKey: ["sepay"] });
                await queryClient.invalidateQueries({ queryKey: ["settings"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Bật webhook SePay (nhận biến động số dư)
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={autoPay} onChange={(e) => setAutoPay(e.target.checked)} disabled={!bank} />
              Tự động ghi nhận thu theo mã CK (theo ví / STK)
            </label>
            <p className="text-xs text-muted-foreground">
              Tắt auto = chỉ Check tiền (sổ phụ). Bật auto = khớp mã SB + đúng tiền + đúng STK → thu đơn + ví chuyển khoản.
            </p>
            <div>
              <Label htmlFor="sepay-key">API Key (Authorization: Apikey …)</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Input
                  id="sepay-key"
                  className="min-h-11 flex-1 font-mono text-sm"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sb_…"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={async () => {
                    try {
                      const next = await regenerateSePayKey();
                      setApiKey(next.apiKey);
                      setEnabled(true);
                      toast.success("Đã tạo API key mới — copy sang SePay");
                      await queryClient.invalidateQueries({ queryKey: ["sepay"] });
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Tạo / đổi key
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(apiKey);
                      toast.success("Đã copy API key");
                    } catch {
                      toast.error("Không copy được");
                    }
                  }}
                  disabled={!apiKey}
                >
                  Copy key
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="sepay-hint">Gợi ý tài khoản trên SePay</Label>
              <Input id="sepay-hint" className="mt-1 min-h-11" value={accountHint} onChange={(e) => setAccountHint(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="sepay-hook">Đường webhook</Label>
              <Input id="sepay-hook" className="mt-1 min-h-11 font-mono text-sm" value={webhookPath} readOnly />
            </div>
            <div>
              <Label htmlFor="sepay-note">Ghi chú</Label>
              <Textarea id="sepay-note" className="mt-1" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu"}
            </Button>
          </form>
        </>
      ) : (
        <CheckTienPanel />
      )}
    </div>
  );
}

function CheckTienPanel() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "matched" | "unmatched" | "manual" | "ignored">("unmatched");
  const txns = useQuery({
    queryKey: ["bank-txns", filter],
    queryFn: () => listBankTxns({ data: { status: filter } }),
  });
  const orders = useQuery({ queryKey: ["orders-lite"], queryFn: () => getOrders() });
  const [attachId, setAttachId] = useState<string | null>(null);
  const [orderQ, setOrderQ] = useState("");
  const [busy, setBusy] = useState(false);

  const orderChoices = (orders.data?.orders ?? [])
    .filter((row) => {
      const q = orderQ.trim().toLowerCase();
      if (!q) return true;
      return row.code.toLowerCase().includes(q) || (row.customerName ?? "").toLowerCase().includes(q);
    })
    .slice(0, 12);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["unmatched", "Chưa khớp"],
            ["matched", "Đã khớp"],
            ["manual", "Tay"],
            ["ignored", "Bỏ qua"],
            ["all", "Tất cả"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === id ? "border-[#2563eb] bg-[#2563eb] text-white" : "bg-card"}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {txns.isLoading ? <p className="text-muted-foreground">Đang tải biến động…</p> : null}
      {(txns.data?.rows ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p> : null}
      <ul className="space-y-2">
        {(txns.data?.rows ?? []).map((row) => (
          <li key={row.id} className="rounded-xl border bg-card p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">
                  {row.amountIn > 0 ? `+${formatVnd(row.amountIn)}` : `−${formatVnd(row.amountOut)}`}
                  <StatusBadge status={row.matchStatus} />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(row.transactionDate).toLocaleString("vi-VN")} · STK {row.accountNumber || "—"} · GD {row.sepayId}
                </p>
                <p className="mt-1 text-xs">
                  <span className="font-medium">Nội dung:</span> {row.contentUi || row.content || "—"}
                </p>
                <p className="text-xs text-muted-foreground">{row.matchReason}</p>
                {row.orderCode ? (
                  <p className="mt-1 text-xs">
                    Đơn{" "}
                    <Link className="font-semibold text-[#2563eb] underline" to="/admin/don-hang/$code" params={{ code: row.orderCode }}>
                      {row.orderCode}
                    </Link>
                    {row.orderCustomer ? ` · ${row.orderCustomer}` : ""}
                  </p>
                ) : null}
              </div>
              {row.matchStatus === "unmatched" && row.amountIn > 0 ? (
                <div className="flex flex-col gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => setAttachId(attachId === row.id ? null : row.id)}>
                    Gắn tay
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await ignoreBankTxn({ data: { txnId: row.id } });
                        toast.success("Đã bỏ qua");
                        await queryClient.invalidateQueries({ queryKey: ["bank-txns"] });
                        await queryClient.invalidateQueries({ queryKey: ["sepay"] });
                      } catch (error) {
                        toast.error((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Bỏ qua
                  </Button>
                </div>
              ) : null}
            </div>
            {attachId === row.id ? (
              <div className="mt-3 space-y-2 rounded-lg border bg-muted/40 p-3">
                <Input className="min-h-10" placeholder="Tìm mã đơn / tên khách…" value={orderQ} onChange={(e) => setOrderQ(e.target.value)} />
                <ul className="max-h-40 space-y-1 overflow-auto">
                  {orderChoices.map((order) => (
                    <li key={order.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-background"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await reconcileBankTxn({ data: { txnId: row.id, orderId: order.id, createPayment: true } });
                            toast.success(`Đã gắn ${order.code}`);
                            setAttachId(null);
                            await queryClient.invalidateQueries({ queryKey: ["bank-txns"] });
                            await queryClient.invalidateQueries({ queryKey: ["sepay"] });
                            await queryClient.invalidateQueries({ queryKey: ["order"] });
                          } catch (error) {
                            toast.error((error as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        <span className="font-semibold">{order.code}</span>
                        <span className="text-xs text-muted-foreground">{order.customerName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "matched"
      ? "bg-emerald-100 text-emerald-800"
      : status === "unmatched"
        ? "bg-rose-100 text-rose-800"
        : status === "manual"
          ? "bg-amber-100 text-amber-900"
          : "bg-slate-100 text-slate-700";
  const label =
    status === "matched" ? "Matched" : status === "unmatched" ? "Unmatched" : status === "manual" ? "Tay" : status === "ignored" ? "Bỏ qua" : status;
  return <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>;
}
