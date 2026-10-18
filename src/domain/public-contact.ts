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
