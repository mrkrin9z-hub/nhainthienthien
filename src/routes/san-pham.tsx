import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDownUp, SearchX } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ProductCard } from "@/components/site/shop-ui";
import { catalogQueryOptions, minPrice } from "@/lib/catalog.functions";

type Search = { q?: string; cat?: string };

export const Route = createFileRoute("/san-pham")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const out: Search = {};
    if (typeof search["q"] === "string" && search["q"].trim()) out.q = search["q"].trim().slice(0, 80);
    if (typeof search["cat"] === "string" && search["cat"].trim()) out.cat = search["cat"].trim().slice(0, 40);
    return out;
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions),
  head: () => ({
    meta: [
      { title: "Sản phẩm & bảng giá in ảnh — Nhà In Thiên Thiên" },
      {
        name: "description",
        content:
          "Xem ảnh mẫu và giá từng kích thước: ảnh tráng gương 4K, thời khóa biểu, nam châm tủ lạnh, nam châm Lái Mới và ảnh lụa. Chọn size, chọn số lượng và đặt mua ngay.",
      },
      { property: "og:title", content: "Sản phẩm & bảng giá in ảnh — Nhà In Thiên Thiên" },
      {
        property: "og:description",
        content: "Chọn khổ, chọn số lượng, đặt in trên web. Bảng giá công khai.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

/** Bỏ dấu tiếng Việt để tìm "trang guong" vẫn ra "tráng gương". */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[×x]/g, "x");
}

type Sort = "relevant" | "asc" | "desc";

function ProductsPage() {
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const { q, cat } = Route.useSearch();
  const [sort, setSort] = useState<Sort>("relevant");

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products]);

  const visible = useMemo(() => {
    const words = q ? fold(q).split(/\s+/).filter(Boolean) : [];
    const list = products.filter((product) => {
      if (cat && product.category !== cat) return false;
      if (!words.length) return true;
      const hay = fold(`${product.name} ${product.category} ${product.description} ${product.variants.map((v) => v.name).join(" ")}`);
      return words.every((word) => hay.includes(word));
    });
    if (sort === "relevant") return list;
    return [...list].sort((a, b) => {
      const pa = minPrice(a) ?? Number.MAX_SAFE_INTEGER;
      const pb = minPrice(b) ?? Number.MAX_SAFE_INTEGER;
      return sort === "asc" ? pa - pb : pb - pa;
    });
  }, [products, q, cat, sort]);

  return (
    <div className="shop-ui min-h-screen bg-shop-bg">
      <SiteHeader query={q} />
      <main className="mx-auto max-w-6xl px-2.5 pb-20 md:px-6 md:pb-0 md:pt-5">
        <h1 className="sr-only">Sản phẩm & bảng giá</h1>
        <div className="glass-panel sticky top-14 z-10 -mx-2.5 md:static md:mx-0 md:rounded-[18px]">
          <div className="scrollbar-none flex gap-2 overflow-x-auto px-3 pb-1.5 pt-2.5">
            {[undefined, ...categories].map((c) => {
              const active = (c ?? "") === (cat ?? "");
              return (
                <Link
                  key={c ?? "all"}
                  to="/san-pham"
                  search={{ ...(q ? { q } : {}), ...(c ? { cat: c } : {}) }}
                  className={`flex min-h-8 shrink-0 items-center rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                    active ? "bg-brand-blue text-white shadow-[0_6px_14px_-8px_rgb(21_94_154/0.9)]" : "bg-white text-[#123047]/80 shadow-[0_0_0_1px_rgb(18_48_71/0.08)] hover:text-brand-blue"
                  }`}
                >
                  {c ?? "Tất cả"}
                </Link>
              );
            })}
          </div>
          <div className="mx-3 mb-2.5 mt-1 grid grid-cols-3 rounded-full bg-[#eef2f7] p-1 text-center text-sm md:max-w-sm">
            <button
              type="button"
              onClick={() => setSort("relevant")}
              className={`min-h-9 rounded-full transition-colors ${sort === "relevant" ? "bg-white font-semibold text-brand-blue shadow-sm" : "text-[#123047]/70"}`}
            >
              Liên quan
            </button>
            <button
              type="button"
              onClick={() => setSort(sort === "asc" ? "desc" : "asc")}
              className={`col-span-2 flex min-h-9 items-center justify-center gap-1 rounded-full transition-colors ${sort !== "relevant" ? "bg-white font-semibold text-brand-blue shadow-sm" : "text-[#123047]/70"}`}
            >
              Giá {sort === "asc" ? "thấp → cao" : sort === "desc" ? "cao → thấp" : ""}
              <ArrowDownUp className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {q ? (
          <p className="px-3 pt-3 text-sm text-muted-foreground">
            Kết quả cho “<span className="text-foreground">{q}</span>”: {visible.length} sản phẩm
          </p>
        ) : null}

        {visible.length ? (
          <div className="grid grid-cols-2 gap-2.5 pt-3 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-muted-foreground">
            <SearchX className="size-10" aria-hidden />
            Không tìm thấy sản phẩm phù hợp.
            <Link to="/san-pham" className="font-semibold text-sale">
              Xem tất cả sản phẩm
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
