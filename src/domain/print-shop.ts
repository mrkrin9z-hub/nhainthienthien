import type { OrderStatus } from "./types.ts";

export const TRANSFER_BANKS = [
  { id: "970436", label: "Vietcombank" },
  { id: "970415", label: "VietinBank" },
  { id: "970418", label: "BIDV" },
  { id: "970405", label: "Agribank" },
  { id: "970407", label: "Techcombank" },
  { id: "970422", label: "MB Bank" },
  { id: "970416", label: "ACB" },
  { id: "970432", label: "VPBank" },
  { id: "970423", label: "TPBank" },
  { id: "970403", label: "Sacombank" },
  { id: "970437", label: "HDBank" },
  { id: "970426", label: "MSB" },
  { id: "970448", label: "OCB" },
  { id: "970441", label: "VIB" },
  { id: "970443", label: "SHB" },
  { id: "970431", label: "Eximbank" },
  { id: "970449", label: "LPBank" },
  { id: "970440", label: "SeABank" },
] as const;

export type TransferBank = {
  id: string;
  account: string;
  holder: string;
};

export function bankLabel(id: string): string {
  return TRANSFER_BANKS.find((bank) => bank.id === id)?.label ?? "";
}

export function cleanBank(input: { id?: string; account?: string; holder?: string } | null): TransferBank | null {
  if (!input) return null;
  const id = String(input.id ?? "").replace(/\D/g, "");
  const account = String(input.account ?? "").replace(/\D/g, "");
  const holder = String(input.holder ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
  if (!id && !account && !holder) return null;
  if (!TRANSFER_BANKS.some((bank) => bank.id === id)) throw new Error("Chọn ngân hàng trong danh sách.");
  if (account.length < 6 || account.length > 19) throw new Error("Số tài khoản chưa đúng.");
  if (holder.length < 2) throw new Error("Tên chủ tài khoản chưa đủ.");
  return { id, account, holder };
}

/** Nội dung chuyển khoản là mã đơn, đủ ngắn để ngân hàng giữ được. */
export function transferContent(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 25);
}

/** Ảnh QR VietQR. Không gọi cổng thanh toán. Nhân viên vẫn tự ghi lần thu. */
export function transferQrUrl(input: { bank: TransferBank; amount: number; code: string }): string | null {
  const amount = Math.round(input.amount);
  const content = transferContent(input.code);
  if (!bankLabel(input.bank.id) || amount <= 0 || !content) return null;
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: content,
    accountName: input.bank.holder,
  });
  return `https://img.vietqr.io/image/${input.bank.id}-${input.bank.account}-compact2.png?${params.toString()}`;
}

export type LineSnap = { name: string; quantity: number; unitPrice: number | null };

function dong(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function lineText(line: LineSnap, showPrice: boolean): string {
  const price = showPrice && line.unitPrice !== null ? ` ${dong(line.unitPrice)}` : "";
  return `${line.quantity}× ${line.name}${price}`;
}

function lineKey(line: LineSnap): string {
  return `${line.name}\u0000${line.quantity}\u0000${line.unitPrice ?? ""}`;
}

/** Câu hiện ở tab Lịch sử. Null khi dòng hàng không đổi. */
export function itemChangeNote(before: LineSnap[], after: LineSnap[], showPrice: boolean): string | null {
  if (before.map(lineKey).join("|") === after.map(lineKey).join("|")) return null;
  const priceOnly =
    before.length === after.length &&
    before.every((line, index) => line.name === after[index]?.name && line.quantity === after[index]?.quantity);
  if (priceOnly && !showPrice) return "Đổi giá bán";
  return `${before.map((line) => lineText(line, showPrice)).join(", ") || "trống"} thành ${after.map((line) => lineText(line, showPrice)).join(", ") || "trống"}`;
}

export type PackCheck = { ep: boolean; bo: boolean; tem: boolean };

export function emptyPackCheck(): PackCheck {
  return { ep: false, bo: false, tem: false };
}

export function packReady(check: PackCheck | undefined, hasPhoto: boolean): boolean {
  return Boolean(check?.ep && check?.bo && check?.tem && hasPhoto);
}

export function hasPackingPhoto(files: { kind: string; status: string; deletedAt?: string | null }[]): boolean {
  return files.some((file) => file.kind === "packing_photo" && file.status === "complete" && !file.deletedAt);
}

/** Sang Giao hoặc Xong từ bước trước Giao thì phải xong checklist. */
export function needsPackCheck(current: OrderStatus, next: OrderStatus): boolean {
  if (next !== "giao" && next !== "xong") return false;
  const order = ["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong"];
  const from = order.indexOf(current);
  const gate = order.indexOf("giao");
  if (from < 0) return false;
  return from < gate;
}

export const FEEDBACK_ANSWERS = [
  { id: "dung_y", label: "Đúng ý" },
  { id: "sai_mau", label: "Sai màu" },
  { id: "sai_kho", label: "Sai khổ" },
  { id: "khac", label: "Khác" },
] as const;

export type FeedbackAnswer = (typeof FEEDBACK_ANSWERS)[number]["id"];

export function feedbackAnswer(value: string): FeedbackAnswer | null {
  return FEEDBACK_ANSWERS.some((item) => item.id === value) ? (value as FeedbackAnswer) : null;
}

export function feedbackLabel(answer: FeedbackAnswer): string {
  return FEEDBACK_ANSWERS.find((item) => item.id === answer)?.label ?? answer;
}

export function feedbackOpensReprint(answer: FeedbackAnswer): boolean {
  return answer !== "dung_y";
}

const FRESH_MS = 36 * 60 * 60 * 1000;

export type DeskAlert = {
  code: string;
  kind: "san" | "tre";
  title: string;
  body: string;
};

export function deskAlerts(
  rows: { code: string; channel: string; status: string; createdAt: string; customerName: string; late: boolean }[],
  now: number,
): DeskAlert[] {
  const alerts: DeskAlert[] = [];
  for (const row of rows) {
    if (row.status === "huy" || row.status === "xong" || row.status === "giao") continue;
    const name = row.customerName || "Khách";
    if (row.late) {
      alerts.push({ code: row.code, kind: "tre", title: `Đơn trễ ${row.code}`, body: `${name} quá mốc giao sàn.` });
      continue;
    }
    const fresh = now - new Date(row.createdAt).getTime() < FRESH_MS;
    if (fresh && (row.channel === "tiktok" || row.channel === "shopee")) {
      const channel = row.channel === "tiktok" ? "TikTok" : "Shopee";
      alerts.push({ code: row.code, kind: "san", title: `Đơn sàn ${row.code}`, body: `${name} vừa về từ ${channel}.` });
    }
  }
  return alerts.slice(0, 8);
}
