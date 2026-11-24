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

/** Số Zalo chính thức của tiệm. Không bao giờ dùng 0778662227. */
export const DEFAULT_ZALO_PHONE = "0777468766";
export const DEFAULT_ZALO_HREF = `https://zalo.me/${DEFAULT_ZALO_PHONE}`;
const BLOCKED_ZALO_PHONES = new Set(["0778662227"]);

function zaloDigits(value?: string | null): string {
  if (!value) return "";
  const href = value.trim();
  const fromUrl = href.match(/zalo\.me\/(\+?\d+)/i);
  const digits = (fromUrl ? fromUrl[1] : href).replace(/\D/g, "");
  return digits;
}

/** Link nút Zalo trên trang công khai: lấy từ CMS, mặc định số mới, chặn số cũ. */
export function resolvePublicZaloHref(input?: { zalo?: string | null; phoneRaw?: string | null } | null): string {
  const digits = zaloDigits(input?.zalo) || zaloDigits(input?.phoneRaw) || DEFAULT_ZALO_PHONE;
  if (digits.length < 8 || BLOCKED_ZALO_PHONES.has(digits)) return DEFAULT_ZALO_HREF;
  return `https://zalo.me/${digits}`;
}
