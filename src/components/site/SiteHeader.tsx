import { Link } from "@tanstack/react-router";
import { Home, Images, Menu, Search, UploadCloud, X } from "lucide-react";
import { useState } from "react";

import { LOGO_HORIZONTAL } from "@/lib/assets";
import { BRAND } from "@/lib/brand";

const NAV = [
  { to: "/san-pham", label: "Sản phẩm" },
  { to: "/huong-dan", label: "Hướng dẫn" },
  { to: "/lien-he", label: "Liên hệ" },
  { to: "/tra-cuu", label: "Tra cứu" },
] as const;

const TABS = [
  { to: "/", label: "Trang chủ", icon: Home, exact: true },
  { to: "/san-pham", label: "Sản phẩm", icon: Images, exact: false },
  { to: "/dat-in", label: "Đặt in", icon: UploadCloud, exact: false },
  { to: "/tra-cuu", label: "Tra cứu", icon: Search, exact: false },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-[4.5rem] md:px-6">
          <button
            type="button"
            aria-label={open ? "Đóng menu" : "Mở menu"}
            onClick={() => setOpen((value) => !value)}
            className="flex size-11 items-center justify-center rounded-full text-primary md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link to="/" className="flex items-center" onClick={() => setOpen(false)}>
            <img src={LOGO_HORIZONTAL} alt={BRAND.name} className="h-8 w-auto md:h-10" />
          </Link>
          <nav className="ml-8 hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-semibold tracking-wide text-foreground/70 transition-colors hover:text-primary"
                activeProps={{ className: "text-primary" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/dat-in"
            className="ml-auto hidden min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground md:inline-flex"
          >
            Đặt in
          </Link>
        </div>
        {open ? (
          <nav className="border-t border-border bg-background px-4 py-2 md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-3 py-3 text-base font-semibold"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>
      <nav
        className="site-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Điều hướng"
      >
        <ul className="grid grid-cols-4">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <Link
                to={tab.to}
                activeOptions={{ exact: tab.exact }}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-muted-foreground"
                activeProps={{ className: "text-primary" }}
              >
                <tab.icon className="size-5" />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
