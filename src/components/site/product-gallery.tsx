import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { ImagePlaceholder } from "@/components/site/shop-ui";
import { galleryItemsForSelection, type MediaItem } from "@/lib/product-media";

function wrap(i: number, n: number) {
  if (n <= 0) return 0;
  return ((i % n) + n) % n;
}

export function ProductGallery({
  items,
  selectedSrc = null,
  selectedAlt,
}: {
  items: MediaItem[];
  selectedSrc?: string | null;
  selectedAlt?: string;
}) {
  const resolved = useMemo(
    () => galleryItemsForSelection(items, selectedSrc, selectedAlt),
    [items, selectedSrc, selectedAlt],
  );
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(resolved.index);
  const [lightbox, setLightbox] = useState(false);
  const current = resolved.items[index] ?? resolved.items[0];

  function scrollThumb(i: number) {
    const row = thumbs.current;
    const el = row?.children[i] as HTMLElement | undefined;
    if (!row || !el) return;
    const left = el.offsetLeft - (row.clientWidth - el.clientWidth) / 2;
    row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }

  function go(i: number, behavior: ScrollBehavior = "smooth") {
    const next = wrap(i, resolved.items.length);
    setIndex(next);
    const el = track.current;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior });
    scrollThumb(next);
  }

  function shiftThumbs(dir: -1 | 1) {
    const row = thumbs.current;
    if (!row) return;
    row.scrollBy({ left: dir * Math.max(160, row.clientWidth * 0.7), behavior: "smooth" });
  }

  useLayoutEffect(() => {
    setLightbox(false);
    setIndex(resolved.index);
    const el = track.current;
    if (el) el.scrollTo({ left: resolved.index * el.clientWidth, behavior: "instant" });
    scrollThumb(resolved.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved.items, resolved.index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "Escape" && lightbox) {
        event.preventDefault();
        setLightbox(false);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(index - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(index + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, lightbox, resolved.items.length]);

  if (!resolved.items.length) return <ImagePlaceholder className="aspect-square w-full" />;

  const many = resolved.items.length > 1;
  const heroNavBtn =
    "absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#123047] shadow-[0_4px_16px_-6px_rgb(18_48_71/0.55)] hover:bg-white md:size-11";

  return (
    <div className="min-w-0" data-gallery-index={index} data-gallery-src={current && current.kind === "image" ? current.src : ""}>
      <div className="relative md:overflow-hidden md:rounded-2xl">
        <div
          ref={track}
          className="snap-gallery flex overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {resolved.items.map((item, i) => (
            <div key={`${item.src}-${i}`} className="skeleton w-full shrink-0">
              {item.kind === "video" ? (
                <video src={item.src} poster={item.poster} controls playsInline preload="metadata" className="aspect-square w-full bg-black object-contain" aria-label={item.alt} />
              ) : (
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  aria-label="Xem ảnh phóng to"
                  className="block w-full cursor-zoom-in"
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    width={900}
                    height={900}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="aspect-square w-full object-cover"
                  />
                </button>
              )}
            </div>
          ))}
        </div>
        {many ? (
          <>
            <button type="button" aria-label="Ảnh trước" className={`${heroNavBtn} left-2`} onClick={() => go(index - 1)}>
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button type="button" aria-label="Ảnh sau" className={`${heroNavBtn} right-2`} onClick={() => go(index + 1)}>
              <ChevronRight className="size-6" aria-hidden />
            </button>
            <span className="gallery-count glass-dark glass-blur pointer-events-none absolute bottom-3 right-3 z-10 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums">
              {index + 1}/{resolved.items.length}
            </span>
          </>
        ) : null}
      </div>
      {many ? (
        <div className="relative mt-2">
          <button
            type="button"
            aria-label="Cuộn danh sách ảnh sang trái"
            onClick={() => shiftThumbs(-1)}
            className="absolute top-1/2 left-0 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#123047] shadow"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div ref={thumbs} className="scrollbar-none flex gap-2 overflow-x-auto px-9">
            {resolved.items.map((item, i) => (
              <button
                key={`thumb-${item.src}-${i}`}
                type="button"
                aria-label={`Xem ảnh ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
                className={`size-16 shrink-0 overflow-hidden rounded-xl transition-shadow sm:size-20 ${i === index ? "shadow-[0_0_0_2px_var(--sale)]" : "opacity-80 hover:opacity-100"}`}
              >
                {item.kind === "video" ? (
                  <span className="grid size-full place-items-center bg-black text-xs text-white">Video</span>
                ) : (
                  <img src={item.src} alt="" loading="lazy" width={900} height={900} className="size-full object-cover" />
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Cuộn danh sách ảnh sang phải"
            onClick={() => shiftThumbs(1)}
            className="absolute top-1/2 right-0 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#123047] shadow"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      ) : null}

      {lightbox && current?.kind === "image" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phóng to"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#123047]/85 p-3"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            aria-label="Đóng"
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white/95 text-[#123047]"
            onClick={() => setLightbox(false)}
          >
            <X className="size-5" aria-hidden />
          </button>
          {many ? (
            <button
              type="button"
              aria-label="Ảnh trước"
              className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#123047]"
              onClick={(event) => {
                event.stopPropagation();
                go(index - 1);
              }}
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
          ) : null}
          <img
            src={current.src}
            alt={current.alt}
            className="max-h-[90vh] max-w-[min(96vw,1100px)] object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          {many ? (
            <button
              type="button"
              aria-label="Ảnh sau"
              className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-[#123047]"
              onClick={(event) => {
                event.stopPropagation();
                go(index + 1);
              }}
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
