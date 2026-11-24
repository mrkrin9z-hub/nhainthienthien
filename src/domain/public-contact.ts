/** Số Zalo trên web chỉ hiện khi chủ bật đúng `true`. Sổ cũ thiếu field thì ẩn. */
export function publicContact(settings: { showZalo?: boolean; zaloPhone?: string | null }): {
  showZalo: boolean;
  phone: string;
  phoneRaw: string;
  zalo: string;
} {
  const digits = (settings.zaloPhone ?? "").replace(/\D/g, "");
  const show = settings.showZalo === true && digits.length >= 8;
  const phone = digits.length === 10 ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : digits;
  return {
    showZalo: show,
    phone: show ? phone : "",
    phoneRaw: show ? digits : "",
    zalo: show ? `https://zalo.me/${digits}` : "",
  };
}

/** Số điện thoại quốc tế cho SEO / tel:, ví dụ 0777468766 → +84777468766. */
export function telE164(digits: string): string {
  const raw = digits.replace(/\D/g, "");
  if (!raw) return "";
  if (raw.startsWith("84")) return `+${raw}`;
  if (raw.startsWith("0")) return `+84${raw.slice(1)}`;
  return `+84${raw}`;
}
