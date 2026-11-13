import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Home, LayoutGrid, ReceiptText, Search, ShoppingCart } from "lucide-react";
import { useState, type FormEvent } from "react";

import { LOGO_SQUARE } from "@/lib/assets";
import { BRAND } from "@/lib/brand";
import { useCart } from "@/lib/cart";

const TOP_LINKS = [
  { to: "/chinh-sach", label: "Chính sách" },
  { to: "/huong-dan", label: "Hướng dẫn" },
  { to: "/tra-cuu", label: "Tra cứu đơn" },
  { to: "/lien-he", label: "Liên hệ" },
] as const;

const TABS = [
  { to: "/", label: "Trang chủ", icon: Home, exact: true },
  { to: "/san-pham", label: "Danh mục", icon: LayoutGrid, exact: false },
  { to: "/gio-hang", label: "Giỏ hàng", icon: ShoppingCart, exact: false },
  { to: "/tra-cuu", label: "Đơn hàng", icon: ReceiptText, exact: false },
] as const;

export function CartButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { count } = useCart();
  return (
    <Link
      to="/gio-hang"
      aria-label={count ? `Giỏ hàng, ${count} sản phẩm` : "Giỏ hàng"}
      className={`relative grid size-10 shrink-0 place-items-center rounded-full ${tone === "light" ? "text-white" : "text-foreground"}`}
    >
      <ShoppingCart className="size-6" />
      {count > 0 ? (
        <span className="absolute -right-0.5 top-0 min-w-5 rounded-full border-2 border-white bg-cta px-1 text-center text-[11px] font-bold leading-4 text-cta-foreground">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function SearchBox({ defaultValue = "" }: { defaultValue?: string | undefined }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(defaultValue);
  function submit(event: FormEvent) {
    event.preventDefault();
    const text = q.trim();
    navigate({ to: "/san-pham", search: text ? { q: text } : {} });
  }
  return (
    <form role="search" onSubmit={submit} className="flex min-w-0 flex-1 items-center gap-2 rounded-sm bg-white px-3 shadow-sm">
      <Search className="size-4 shrink-0 text-brand-blue" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm ảnh tráng gương, thời khóa biểu…"
        aria-label="Tìm sản phẩm"
        className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
      <button type="submit" className="hidden h-8 shrink-0 rounded-sm bg-cta px-5 text-sm font-semibold text-cta-foreground md:block">
        Tìm
      </button>
    </form>
  );
}

/**
 * Thanh trên kiểu app sàn: cam đỏ, ô tìm kiếm, giỏ hàng. Thanh tab dưới trên điện thoại.
 * `back`: hiện nút quay lại (trang chi tiết, giỏ, thanh toán). `hideTabs`: trang có thanh mua riêng.
 */
export function SiteHeader({ back, title, hideTabs, query }: { back?: boolean; title?: string; hideTabs?: boolean; query?: string | undefined }) {
  const router = useRouter();
  return (
    <>
      <header className="sticky top-0 z-40 bg-sale-gradient text-white shadow-sm">
        <div className="mx-auto hidden h-8 max-w-6xl items-center justify-between px-6 text-xs md:flex">
          <span className="opacity-90">{BRAND.address}</span>
          <nav className="flex items-center gap-5">
            <a href={BRAND.shopeeUrl} target="_blank" rel="noopener" className="opacity-90 hover:opacity-100">
              Shopee: nhainthienthien
            </a>
            {TOP_LINKS.map((item) => (
              <Link key={item.to} to={item.to} className="opacity-90 hover:opacity-100">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 md:h-20 md:gap-6 md:px-6">
          {back ? (
            <button
              type="button"
              aria-label="Quay lại"
              onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" }))}
              className="grid size-10 shrink-0 place-items-center rounded-full md:hidden"
            >
              <ChevronLeft className="size-6" />
            </button>
          ) : (
            <Link to="/" aria-label={BRAND.name} className="shrink-0 md:hidden">
              <img src={LOGO_SQUARE} alt="" className="size-9 rounded-full bg-white object-contain p-0.5" />
            </Link>
          )}
          <Link to="/" className="hidden shrink-0 items-center gap-3 md:flex">
            <img src={LOGO_SQUARE} alt="" className="size-12 rounded-full bg-white object-contain p-1" />
            <span className="text-xl font-extrabold leading-tight">
              Nhà In
              <span className="block text-base font-bold opacity-95">Thiên Thiên</span>
            </span>
          </Link>
          {title ? (
            <h1 className="min-w-0 flex-1 truncate text-base font-semibold md:hidden">{title}</h1>
          ) : null}
          <div className={title ? "hidden min-w-0 flex-1 md:flex" : "flex min-w-0 flex-1"}>
            <SearchBox defaultValue={query} />
          </div>
          <CartButton />
        </div>
      </header>
      {hideTabs ? null : (
        <nav
          className="site-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
          aria-label="Điều hướng"
        >
          <ul className="grid grid-cols-4">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  activeOptions={{ exact: tab.exact }}
                  className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
                  activeProps={{ className: "text-brand-blue" }}
                >
                  <tab.icon className="size-5" />
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
