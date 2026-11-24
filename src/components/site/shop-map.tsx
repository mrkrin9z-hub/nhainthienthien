import { MapPin, Navigation } from "lucide-react";

import { BRAND, mapsDirectionsUrl, mapsEmbedUrl } from "@/lib/brand";

export function ShopMapBlock({
  address,
  mapsUrl,
  hours,
}: {
  address?: string;
  mapsUrl?: string;
  hours?: string;
}) {
  const addr = address?.trim() || BRAND.address;
  const directions = mapsDirectionsUrl(mapsUrl);
  const embed = mapsEmbedUrl(mapsUrl, addr);
  return (
    <section className="card mt-3 overflow-hidden" aria-labelledby="tim-duong-title" data-shop-map>
      <div className="px-3.5 pt-3.5 md:px-5 md:pt-5">
        <h2 id="tim-duong-title" className="section-title">
          Tìm đường tới tiệm
        </h2>
        <p className="mt-2 flex items-start gap-1.5 text-sm leading-relaxed text-foreground/85">
          <MapPin className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
          <span>{addr}</span>
        </p>
        {hours ? <p className="mt-0.5 pl-6 text-xs text-muted-foreground">Mở cửa {hours}</p> : null}
        <a
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cta mt-3 inline-flex min-h-11 items-center gap-1.5 px-5 text-sm"
        >
          <Navigation className="size-4" aria-hidden />
          Chỉ đường
        </a>
      </div>
      <div className="mt-3 aspect-[4/3] w-full bg-[#e8eef4] md:aspect-[2/1] lg:aspect-[21/9]">
        <iframe
          title="Bản đồ Nhà In Thiên Thiên — Số 67 Ngô Quyền, Xuân Lộc, Đồng Nai"
          src={embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="size-full border-0"
        />
      </div>
    </section>
  );
}
