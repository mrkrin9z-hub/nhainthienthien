/**
 * Hiệu ứng nhẹ cho gian hàng (không dùng thư viện): gợn sóng khi bấm, ảnh hiện dần khi tải xong,
 * hiệu ứng bay vào giỏ. Tất cả tắt khi máy bật "giảm chuyển động".
 */

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

const RIPPLE_SELECTOR = "[data-ripple], button.bg-cta, a.bg-cta, button.bg-sale, a.bg-sale, button.bg-brand-blue, a.bg-brand-blue";
let installed = false;

/** Gắn một lần ở trang gốc (chỉ chạy trên trình duyệt). */
export function installMotion() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  const root = document.documentElement;

  // Ảnh tải lười hiện dần: làm bằng CSS (styles.css), không sửa thẻ <img> để không lệch lúc hydrate.
  void root;

  if (reducedMotion()) return;
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(RIPPLE_SELECTOR) : null;
      if (!target || target.closest("[data-no-ripple]") || (target as HTMLButtonElement).disabled) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const style = getComputedStyle(target);
      if (style.position === "static") target.style.position = "relative";
      if (style.overflow === "visible") target.style.overflow = "hidden";
      const dot = document.createElement("span");
      dot.className = "tap-ripple";
      dot.style.width = dot.style.height = `${size}px`;
      dot.style.left = `${event.clientX - rect.left - size / 2}px`;
      dot.style.top = `${event.clientY - rect.top - size / 2}px`;
      target.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
      window.setTimeout(() => dot.remove(), 900);
    },
    { passive: true },
  );
}

function visibleCartIcon(): HTMLElement | null {
  const icons = Array.from(document.querySelectorAll<HTMLElement>("[data-cart-icon]"));
  return (
    icons.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }) ?? null
  );
}

/** Ảnh nhỏ bay từ nút/ảnh sản phẩm vào biểu tượng giỏ, rồi giỏ nảy lên. */
export function flyToCart(from: Element | null, imageSrc?: string | null) {
  const cart = visibleCartIcon();
  if (!cart) return;
  const bump = () => {
    cart.classList.remove("cart-bump");
    void cart.offsetWidth;
    cart.classList.add("cart-bump");
  };
  if (reducedMotion() || !from || typeof Element.prototype.animate !== "function") {
    bump();
    return;
  }
  const a = from.getBoundingClientRect();
  const b = cart.getBoundingClientRect();
  const size = 56;
  const dot = document.createElement("div");
  dot.className = "fly-dot";
  if (imageSrc) dot.style.backgroundImage = `url("${imageSrc.replace(/"/g, "%22")}")`;
  const x0 = a.left + a.width / 2 - size / 2;
  const y0 = a.top + a.height / 2 - size / 2;
  const x1 = b.left + b.width / 2 - size / 2;
  const y1 = b.top + b.height / 2 - size / 2;
  Object.assign(dot.style, { left: `${x0}px`, top: `${y0}px`, width: `${size}px`, height: `${size}px` });
  document.body.appendChild(dot);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const anim = dot.animate(
    [
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(0.8)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.6 },
    ],
    { duration: 620, easing: "cubic-bezier(.45,.05,.55,.95)" },
  );
  const done = () => {
    dot.remove();
    bump();
  };
  anim.onfinish = done;
  anim.oncancel = done;
}
