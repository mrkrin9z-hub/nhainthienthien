import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  BRAND,
  RETIRED_TIKTOK_HANDLES,
  TIKTOK_PRODUCT,
  ensureHttpsUrl,
  resolveFacebookHref,
  resolveShopeeHref,
  resolveTiktokHref,
  tiktokHandleOrDefault,
  tiktokProductIdFromUrl,
  tiktokProductUrl,
  tiktokShopUrlFor,
  tiktokUrl,
  BRAND as BRAND2,
  SHOP_MAPS_CID,
  mapsDirectionsUrl,
  mapsEmbedUrl,
} from "../lib/brand.ts";
import { PRODUCT_MEDIA, galleryFor, galleryItemsForSelection, mediaFor } from "../lib/product-media.ts";
import { resolveSiteContent } from "./site-content.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("link TikTok sản phẩm dùng www.tiktok.com/@nhain.thienthien/product, không dùng shop.tiktok.com/view", () => {
  for (const [slug, id] of Object.entries(TIKTOK_PRODUCT)) {
    const href = tiktokUrl(slug);
    assert.equal(href, `https://www.tiktok.com/@nhain.thienthien/product/${id}`);
    assert.equal(tiktokProductIdFromUrl(href), id);
    assert.doesNotMatch(href, /shop\.tiktok\.com/);
    assert.doesNotMatch(href, /xuonginthienthien/);
    assert.match(href, /^https:\/\//);
  }
  assert.equal(tiktokUrl("ep-go-lua"), "https://www.tiktok.com/@nhain.thienthien");
  assert.equal(tiktokUrl("khong-ton-tai"), BRAND.tiktokShopUrl);
});

test("chuẩn hóa URL TikTok: thiếu https, id sai host, handle cũ, fallback shop", () => {
  assert.equal(ensureHttpsUrl("www.tiktok.com/@nhain.thienthien"), "https://www.tiktok.com/@nhain.thienthien");
  assert.equal(
    resolveTiktokHref("shop.tiktok.com/view/product/1738136614342657804?region=VN"),
    "https://www.tiktok.com/@nhain.thienthien/product/1738136614342657804",
  );
  assert.equal(
    resolveTiktokHref("https://shop.tiktok.com/view/product/1738136614342657804?region=VN"),
    tiktokProductUrl("1738136614342657804"),
  );
  assert.equal(resolveTiktokHref("https://www.tiktok.com/@xuonginthienthien"), BRAND.tiktokShopUrl);
  assert.equal(
    resolveTiktokHref("https://www.tiktok.com/@xuonginthienthien/product/1738136614342657804"),
    "https://www.tiktok.com/@nhain.thienthien/product/1738136614342657804",
  );
  assert.equal(resolveTiktokHref(null), BRAND.tiktokShopUrl);
  assert.equal(resolveTiktokHref("not a url"), BRAND.tiktokShopUrl);
  assert.equal(tiktokHandleOrDefault("@xuonginthienthien"), "@nhain.thienthien");
  assert.equal(tiktokHandleOrDefault("@nhain.thienthien"), "@nhain.thienthien");
  assert.equal(tiktokShopUrlFor("@xuonginthienthien"), BRAND.tiktokShopUrl);
  assert.ok((RETIRED_TIKTOK_HANDLES as readonly string[]).includes("xuonginthienthien"));
});

test("Fanpage và Shopee mặc định đúng, thiếu https thì bổ sung", () => {
  assert.equal(resolveFacebookHref(null), "https://www.facebook.com/profile.php?id=61595796658051");
  assert.equal(resolveFacebookHref(BRAND.facebookPageUrl), BRAND.facebookPageUrl);
  assert.equal(resolveFacebookHref("ftp://evil.example"), BRAND.facebookPageUrl);
  assert.equal(resolveShopeeHref(null), "https://shopee.vn/nhainthienthien");
  assert.equal(resolveShopeeHref("shopee.vn/nhainthienthien"), "https://shopee.vn/nhainthienthien");
  assert.equal(resolveShopeeHref("https://example.com/phishing"), BRAND.shopeeUrl);
});

test("CMS trang chủ không giữ handle TikTok đã nghỉ", () => {
  const site = resolveSiteContent({
    tiktokHandle: "@xuonginthienthien",
    tiktokUrl: "https://www.tiktok.com/@xuonginthienthien",
    facebookUrl: "facebook.com/profile.php?id=61595796658051",
    shopeeUrl: "shopee.vn/nhainthienthien",
  });
  assert.equal(site.tiktokHandle, "@nhain.thienthien");
  assert.equal(site.tiktokUrl, "https://www.tiktok.com/@nhain.thienthien");
  assert.equal(site.facebookUrl, "https://facebook.com/profile.php?id=61595796658051");
  assert.equal(site.shopeeUrl, "https://shopee.vn/nhainthienthien");
});

test("chọn Mẫu 06 Lái Mới đưa ảnh mẫu làm ảnh chính vì không có trong gallery 14 ảnh", () => {
  const media = mediaFor("nam-cham-xe");
  const options = media.designs?.options ?? [];
  assert.equal(options.length, 20);
  const mau06 = options.find((opt) => opt.key === "Mẫu 06");
  assert.ok(mau06);
  assert.equal(mau06!.image, "/media/mau/lai-moi-06.webp");
  const gallery = galleryFor("nam-cham-xe", null, null, "Lái Mới 12×25");
  assert.equal(gallery.length, 14);
  assert.equal(gallery.some((item) => item.kind === "image" && item.src === mau06!.image), false);
  const selected = galleryItemsForSelection(gallery, mau06!.image, mau06!.label);
  assert.equal(selected.index, 0);
  assert.equal(selected.items[0]?.kind, "image");
  if (selected.items[0]?.kind === "image") assert.equal(selected.items[0].src, "/media/mau/lai-moi-06.webp");
  assert.equal(selected.items.length, 15);
});

test("ảnh mẫu đã có trong gallery thì nhảy đúng index, không nhân bản", () => {
  const items = [
    { kind: "image" as const, src: "/media/sp/a.webp", alt: "A" },
    { kind: "image" as const, src: "/media/mau/b.webp", alt: "B" },
    { kind: "image" as const, src: "/media/sp/c.webp", alt: "C" },
  ];
  const selected = galleryItemsForSelection(items, "/media/mau/b.webp?x=1", "B");
  assert.equal(selected.index, 1);
  assert.equal(selected.items.length, 3);
  assert.deepEqual(
    galleryItemsForSelection(items, null).items,
    items,
  );
});

test("mọi sản phẩm có mẫu: chọn mẫu luôn ra được ảnh chính", () => {
  for (const [slug, media] of Object.entries(PRODUCT_MEDIA)) {
    const options = media.designs?.options ?? [];
    if (!options.length) continue;
    const gallery = galleryFor(slug, media.listingCover ?? null, null, slug);
    for (const opt of options) {
      const selected = galleryItemsForSelection(gallery, opt.image, opt.label);
      const hero = selected.items[selected.index];
      assert.ok(hero && hero.kind === "image");
      if (hero.kind === "image") {
        assert.equal(hero.src.split("?")[0], opt.image);
      }
    }
  }
});

test("gallery có nút trước/sau, cuộn thumbnail, phóng to; thẻ trang chủ có hover", () => {
  const gallery = readFileSync(join(root, "components/site/product-gallery.tsx"), "utf8");
  assert.match(gallery, /aria-label="Ảnh trước"/);
  assert.match(gallery, /aria-label="Ảnh sau"/);
  assert.match(gallery, /aria-label="Cuộn danh sách ảnh sang trái"/);
  assert.match(gallery, /aria-label="Cuộn danh sách ảnh sang phải"/);
  assert.match(gallery, /aria-label="Xem ảnh phóng to"/);
  assert.match(gallery, /ArrowLeft/);
  assert.match(gallery, /ArrowRight/);
  const card = readFileSync(join(root, "components/site/shop-ui.tsx"), "utf8");
  assert.match(card, /hover:-translate-y-1/);
  assert.match(card, /hover:shadow-/);
  assert.match(card, /group-hover:scale-\[1\.05\]/);
  assert.doesNotMatch(card, /product-card card group flex flex-col overflow-hidden/);
  const home = readFileSync(join(root, "routes/index.tsx"), "utf8");
  assert.match(home, /home-tile group/);
  assert.match(home, /hover:-translate-y-1/);
  const css = readFileSync(join(root, "styles.css"), "utf8");
  assert.match(css, /Storefront card hover \(unlayered/);
  const last = css.split("@layer components").pop() ?? "";
  // rule sau khi đóng layer components
  assert.match(css.slice(css.lastIndexOf("/* Storefront card hover")), /\.product-card:hover/);
  void last;
  const links = readFileSync(join(root, "components/site/shop-links.tsx"), "utf8");
  assert.match(links, /rel="noopener noreferrer"/);
  assert.match(links, /target="_blank"/);
});

test("Google Maps: resolve link rút gọn thành embed cid, nút Chỉ đường giữ đúng link anh gửi", () => {
  const sent = "https://maps.app.goo.gl/KMDTbrLZ7TM4sHR76?g_st=ic";
  assert.equal(BRAND.mapsUrl, sent);
  assert.equal(mapsDirectionsUrl(sent), sent);
  assert.equal(mapsDirectionsUrl(null), sent);
  assert.equal(mapsDirectionsUrl("https://example.com/phishing"), sent);
  const embed = mapsEmbedUrl(sent);
  assert.equal(embed, `https://www.google.com/maps?cid=${SHOP_MAPS_CID}&hl=vi&output=embed`);
  assert.match(embed, /output=embed/);
  assert.equal(SHOP_MAPS_CID, "10153097473295889943");
  assert.equal(
    mapsEmbedUrl("https://www.google.com/maps?cid=12345"),
    "https://www.google.com/maps?cid=12345&hl=vi&output=embed",
  );
  const byQ = mapsEmbedUrl("https://www.google.com/maps?q=67+Ngo+Quyen+Xuan+Loc");
  assert.match(byQ, /output=embed/);
  assert.match(byQ, /67/);
  const site = resolveSiteContent({});
  assert.equal(site.mapsUrl, sent);
  assert.match(site.address, /67/);
  assert.match(site.address, /Xuân Lộc/);
  const mapSrc = readFileSync(join(root, "components/site/shop-map.tsx"), "utf8");
  assert.match(mapSrc, /loading="lazy"/);
  assert.match(mapSrc, /Chỉ đường/);
  assert.match(mapSrc, /Tìm đường tới tiệm/);
  assert.match(mapSrc, /target="_blank"/);
  const home = readFileSync(join(root, "routes/index.tsx"), "utf8");
  assert.match(home, /ShopMapBlock/);
  const admin = readFileSync(join(root, "routes/admin.trang-chu.tsx"), "utf8");
  assert.match(admin, /Link Google Maps/);
  assert.match(admin, /mapsUrl/);
});
