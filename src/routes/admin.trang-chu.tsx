import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { formatVnd } from "@/lib/brand";
import { getSiteContent, getWebProduct, saveHomepageCatalog, saveSiteContent } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/trang-chu")({
  component: HomepageAdminPage,
});

function HomepageAdminPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale sửa trang chủ.">
      <HomepageAdminBody />
    </RoleGate>
  );
}

function HomepageAdminBody() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["site-content"], queryFn: () => getSiteContent() });
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [banner, setBanner] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("@nhain.thienthien");
  const [tiktokUrl, setTiktokUrl] = useState("https://www.tiktok.com/@nhain.thienthien");
  const [shopeeUrl, setShopeeUrl] = useState("");
  const [commitments, setCommitments] = useState<string[]>([""]);
  const [rows, setRows] = useState<{ groupId: string; listed: boolean; sort: number; name: string; slug: string; from: number | null; cover: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const skus = useQuery({
    queryKey: ["web-product", detailId],
    queryFn: () => getWebProduct({ data: { groupId: detailId! } }),
    enabled: Boolean(detailId),
  });

  useEffect(() => {
    if (!data.data) return;
    const site = data.data.site;
    setHeroTitle(site.heroTitle ?? "");
    setHeroSubtitle(site.heroSubtitle ?? "");
    setBanner(site.banner ?? "");
    setAddress(site.address ?? "");
    setHours(site.hours ?? "");
    setFacebookUrl(site.facebookUrl ?? "");
    setTiktokHandle(site.tiktokHandle ?? "@nhain.thienthien");
    setTiktokUrl(site.tiktokUrl ?? "https://www.tiktok.com/@nhain.thienthien");
    setShopeeUrl(site.shopeeUrl ?? "");
    setCommitments(site.commitments?.length ? site.commitments : [""]);
    setRows(
      data.data.products.map((product, index) => ({
        groupId: product.id,
        listed: product.listed,
        sort: index + 1,
        name: product.name,
        slug: product.slug,
        from: product.from,
        cover: product.cover,
      })),
    );
  }, [data.data]);

  function move(index: number, delta: number) {
    setRows((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row!);
      return next.map((item, sort) => ({ ...item, sort: sort + 1 }));
    });
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["site-content"] });
    await queryClient.invalidateQueries({ queryKey: ["public-config"] });
    await queryClient.invalidateQueries({ queryKey: ["catalog"] });
    await queryClient.invalidateQueries({ queryKey: ["web-products"] });
  }

  async function saveAll() {
    setSaving(true);
    try {
      const handle = tiktokHandle.replace(/^@?/, "@");
      await saveSiteContent({
        data: {
          heroTitle,
          heroSubtitle,
          banner,
          address,
          hours,
          facebookUrl,
          tiktokHandle: handle,
          tiktokUrl: tiktokUrl || `https://www.tiktok.com/${handle}`,
          shopeeUrl,
          commitments: commitments.map((item) => item.trim()).filter(Boolean),
        },
      });
      await saveHomepageCatalog({
        data: { rows: rows.map((row) => ({ groupId: row.groupId, listed: row.listed, sort: row.sort })) },
      });
      toast.success("Đã lưu trang chủ. Khách thấy ngay, không cần deploy lại.");
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageToolbar
        title="Quản lý trang chủ"
        hint="Sửa chữ, liên hệ, cam kết và danh sách sản phẩm hiện trên nhainthienthien.com. Lưu vào dữ liệu, áp dụng ngay."
        actions={
          <Button className="min-h-10 rounded-xl bg-blue-600 hover:bg-blue-700" disabled={saving} onClick={() => void saveAll()}>
            {saving ? "Đang lưu…" : "Lưu trang chủ"}
          </Button>
        }
      />

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="text-base font-bold">Nội dung trang chủ</h2>
        <label className="block text-sm font-semibold">
          Tiêu đề hero
          <Input className="mt-1 min-h-11" value={heroTitle} onChange={(event) => setHeroTitle(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Mô tả phụ
          <Input className="mt-1 min-h-11" value={heroSubtitle} onChange={(event) => setHeroSubtitle(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Banner / dòng khuyến mãi
          <Input className="mt-1 min-h-11" value={banner} onChange={(event) => setBanner(event.target.value)} placeholder="Freeship từ 300.000đ" />
        </label>
        <label className="block text-sm font-semibold">
          Địa chỉ
          <Input className="mt-1 min-h-11" value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Giờ mở cửa
          <Input className="mt-1 min-h-11" value={hours} onChange={(event) => setHours(event.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">Hotline / Zalo lấy từ Cài đặt (0777 468 766). Không nhập số khác ở đây.</p>
        <label className="block text-sm font-semibold">
          Link Fanpage
          <Input className="mt-1 min-h-11" value={facebookUrl} onChange={(event) => setFacebookUrl(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          TikTok
          <Input className="mt-1 min-h-11" value={tiktokHandle} onChange={(event) => setTiktokHandle(event.target.value)} placeholder="@nhain.thienthien" />
        </label>
        <label className="block text-sm font-semibold">
          Link TikTok
          <Input className="mt-1 min-h-11" value={tiktokUrl} onChange={(event) => setTiktokUrl(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Link Shopee
          <Input className="mt-1 min-h-11" value={shopeeUrl} onChange={(event) => setShopeeUrl(event.target.value)} />
        </label>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Cam kết trên trang chủ</p>
          {commitments.map((item, index) => (
            <Input key={index} className="min-h-11" value={item} onChange={(event) => setCommitments((current) => current.map((row, rowIndex) => (rowIndex === index ? event.target.value : row)))} />
          ))}
          <Button type="button" variant="outline" className="min-h-10" onClick={() => setCommitments((current) => [...current, ""])}>
            Thêm dòng cam kết
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold">Sản phẩm trên trang chủ</h2>
          <Button asChild variant="outline" className="min-h-10">
            <Link to="/admin/san-pham" search={{ m: "nhap" }}>
              Thêm sản phẩm mới
            </Link>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Mỗi dòng đã gắn với sản phẩm/SKU trong admin. Giá lẻ tại tiệm và biến thể trên trang chủ lấy đúng từ bảng giá, không nhập tay ở đây.
        </p>
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li key={row.groupId} className="rounded-2xl border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /{row.slug} · {row.from == null ? "Chưa có giá tại tiệm" : `từ ${formatVnd(row.from)}`} · {row.cover ? "Có ảnh bìa" : "Chưa có ảnh bìa"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="min-h-9" disabled={index === 0} onClick={() => move(index, -1)}>
                    Lên
                  </Button>
                  <Button type="button" variant="outline" className="min-h-9" disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
                    Xuống
                  </Button>
                  <Button type="button" variant="outline" className="min-h-9" onClick={() => setDetailId(detailId === row.groupId ? null : row.groupId)}>
                    {detailId === row.groupId ? "Ẩn SKU" : "SKU đã gán"}
                  </Button>
                </div>
              </div>
              <label className="mt-2 inline-flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4" checked={row.listed} onChange={(event) => setRows((current) => current.map((item) => (item.groupId === row.groupId ? { ...item, listed: event.target.checked } : item)))} />
                Hiện trên trang chủ
              </label>
              {detailId === row.groupId ? (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                  {skus.isLoading ? (
                    <p className="text-muted-foreground">Đang tải SKU…</p>
                  ) : (
                    <ul className="space-y-1">
                      {(skus.data?.sizes ?? []).map((size) => (
                        <li key={size.skuId} className="flex justify-between gap-2">
                          <span>
                            {size.code} · {size.widthCm}×{size.heightCm} cm{size.sheets > 1 ? ` · ${size.sheets} tấm` : ""}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {size.quotes.tai_tiem?.sold && size.quotes.tai_tiem.price != null ? formatVnd(size.quotes.tai_tiem.price) : "Không bán lẻ"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Đổi giá tại{" "}
                    <Link to="/admin/gia" className="font-semibold text-accent">
                      Bảng giá 6 kênh
                    </Link>{" "}
                    hoặc{" "}
                    <Link to="/admin/san-pham" className="font-semibold text-accent">
                      Sản phẩm & Giá
                    </Link>
                    . Ảnh bìa/thư viện tại{" "}
                    <Link to="/admin/anh" className="font-semibold text-accent">
                      Ảnh sản phẩm
                    </Link>
                    .
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
