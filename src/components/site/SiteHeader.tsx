import { Link } from "@tanstack/react-router";
import { Menu, Search, UploadCloud, X } from "lucide-react";
import { useState } from "react";

import { LOGO_HORIZONTAL } from "@/lib/assets";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";

const NAV = [
  { to: "/san-pham", label: "Sản phẩm & giá" },
  { to: "/huong-dan", label: "Hướng dẫn" },
  { to: "/lien-he", label: "Liên hệ" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 glass-panel">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:h-20 md:px-6">
        <button
          type="button"
          aria-label="Mở menu"
          onClick={() => setOpen((v) => !v)}
          className="flex size-11 items-center justify-center rounded-xl text-primary md:hidden"
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>

        <Link to="/" className="flex items-center gap-2">
          <img src={LOGO_HORIZONTAL} alt={BRAND.name} className="h-9 w-auto md:h-11" />
        </Link>

        <nav className="ml-8 hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-sm font-semibold text-foreground/80 transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="outline" className="hidden md:inline-flex">
            <Link to="/tra-cuu">
              <Search className="size-4" />
              Tra cứu đơn
            </Link>
          </Button>
          <Button asChild className="min-h-11 bg-accent px-3 text-accent-foreground hover:bg-accent/90">
            <Link to="/dat-in">
              <UploadCloud className="size-4" />
              Đặt in
            </Link>
          </Button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-border bg-card px-4 py-3 md:hidden">
          {[...NAV, { to: "/tra-cuu", label: "Tra cứu đơn" } as const].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-base font-semibold text-foreground/85"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
