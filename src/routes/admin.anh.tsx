import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { GoodsLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { productImage } from "@/lib/product-images";
import { clearGroupPhoto, getGroupPhotos } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/anh")({
  component: PhotosPage,
});

function PhotosPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <PhotosBody />
    </RoleGate>
  );
}

function PhotosBody() {
  const queryClient = useQueryClient();
  const photos = useQuery({ queryKey: ["group-photos"], queryFn: () => getGroupPhotos() });
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const groups = photos.data ?? [];
  const shown = groups.filter((group) => {
    if (kind === "custom" && !group.custom) return false;
    if (kind === "sample" && group.custom) return false;
    const needle = q.trim().toLowerCase();
    return !needle || group.name.toLowerCase().includes(needle);
  });
  const chips: FilterChip[] = [
    { id: "all", label: "Tất cả", count: groups.length, ...ALL_TONE },
    { id: "custom", label: "Ảnh đã tải", count: groups.filter((group) => group.custom).length, color: "#059669" },
    { id: "sample", label: "Ảnh mẫu", count: groups.filter((group) => !group.custom).length, color: "#6B7280" },
  ];
  const list = useListPage(shown, `${q}|${kind}`);
  if (photos.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (photos.isError) return <p className="font-semibold text-destructive">{(photos.error as Error).message}</p>;
  return (
    <div className="space-y-4">
      <GoodsLinks />
      <PageToolbar
        title="Ảnh sản phẩm"
        hint="Ảnh đang hiện là ảnh mẫu. Tải JPG, PNG hoặc WEBP (tối đa 2MB) để thay. Xóa ảnh tải lên thì web trở lại ảnh mẫu."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên sản phẩm…"
      />
      <FilterChips label="Nguồn ảnh" value={kind} chips={chips} onChange={setKind} />
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="ảnh" onPage={list.setPage} />
      <div className="grid gap-4 sm:grid-cols-2">
        {list.slice.map((group) => {
          const src = group.custom ? `/api/public/product-photo/${group.slug}` : productImage(group.slug);
          return (
            <article key={group.id} className="glass-card rounded-3xl p-4">
              <img src={src} alt={group.name} className="h-36 w-full rounded-2xl object-cover" />
              <h2 className="mt-3 font-bold text-primary">{group.name}</h2>
              <p className="text-sm text-muted-foreground">{group.custom ? "Đang dùng ảnh đã tải." : "Đang dùng ảnh mẫu."}</p>
              <label className="mt-3 block text-sm font-semibold">
                Tải ảnh mới
                <input
                  className="mt-1 block w-full text-sm"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    const body = new FormData();
                    body.set("slug", group.slug);
                    body.set("file", file);
                    const response = await fetch("/api/admin/product-photo", { method: "POST", body });
                    if (!response.ok) {
                      toast.error(await response.text());
                      return;
                    }
                    toast.success("Đã đổi ảnh");
                    await queryClient.invalidateQueries({ queryKey: ["group-photos"] });
                    await queryClient.invalidateQueries({ queryKey: ["catalog"] });
                  }}
                />
              </label>
              {group.custom ? (
                <Button
                  variant="outline"
                  className="mt-3 min-h-11"
                  onClick={async () => {
                    await clearGroupPhoto({ data: { slug: group.slug } });
                    toast.success("Đã về ảnh mẫu");
                    await queryClient.invalidateQueries({ queryKey: ["group-photos"] });
                  }}
                >
                  Dùng lại ảnh mẫu
                </Button>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
