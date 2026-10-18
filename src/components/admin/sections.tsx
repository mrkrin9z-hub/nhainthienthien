import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { getMe } from "@/lib/admin.functions";

type Item = { to: "/admin/don-hang"; label: string };

function pathActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function SectionLinks({ label, items }: { label: string; items: { to: string; label: string }[] }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (items.length < 2) return null;
  return (
    <nav aria-label={label} className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {items.map((item) => {
        const active = pathActive(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to as Item["to"]}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-semibold active:scale-[0.98] ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function OrderLinks() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const production = me.data?.role === "production";
  const items = [
    { to: "/admin/don-hang", label: "Đơn hàng" },
    { to: "/admin/giao-hang", label: "Giao hàng" },
    ...(production ? [] : [
      { to: "/admin/cod", label: "Đối soát COD" },
      { to: "/admin/nhap-don", label: "Nhập đơn sàn" },
    ]),
  ];
  return <SectionLinks label="Đơn hàng" items={items} />;
}

export function CustomerLinks() {
  return (
    <SectionLinks
      label="Khách hàng"
      items={[
        { to: "/admin/khach", label: "Khách hàng" },
        { to: "/admin/nhac-khach", label: "Nhắc khách" },
      ]}
    />
  );
}

export function GoodsLinks() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const role = me.data?.role;
  const items = [
    ...(role === "owner" ? [{ to: "/admin/san-pham", label: "Sản phẩm web" }] : []),
    ...(role === "owner" || role === "sale" ? [{ to: "/admin/gia", label: "Bảng giá" }] : []),
    { to: "/admin/kho", label: "Kho" },
    ...(role === "owner" || role === "sale" ? [{ to: "/admin/anh", label: "Ảnh web" }] : []),
  ];
  return <SectionLinks label="Hàng hóa" items={items} />;
}

export function StaffLinks() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const owner = me.data?.role === "owner";
  return (
    <SectionLinks
      label="Nhân sự"
      items={[
        { to: "/admin/cham-cong", label: "Chấm công" },
        { to: "/admin/luong", label: owner ? "Lương" : "Lương của tôi" },
        { to: "/admin/tai-khoan", label: "Tài khoản" },
      ]}
    />
  );
}

export function MoneyLinks() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (me.data && me.data.role !== "owner") {
    return (
      <SectionLinks
        label="Tài chính"
        items={[{ to: "/admin/kpi", label: "KPI" }]}
      />
    );
  }
  return (
    <SectionLinks
      label="Tài chính"
      items={[
        { to: "/admin/loi-nhuan", label: "Thu chi" },
        { to: "/admin/bao-cao", label: "Báo cáo" },
        { to: "/admin/kpi", label: "KPI" },
      ]}
    />
  );
}
