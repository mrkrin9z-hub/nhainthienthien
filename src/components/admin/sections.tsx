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
    <nav aria-label={label} className="flex gap-1 overflow-x-auto scrollbar-none">
      {items.map((item) => {
        const active = pathActive(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to as Item["to"]}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-8 shrink-0 items-center rounded-md px-2.5 text-[13px] ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
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
      { to: "/orders/create", label: "Ghi đơn" },
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
      items={[{ to: "/admin/khach", label: "Khách hàng" }]}
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
        ...(owner ? [{ to: "/admin/nhan-vien", label: "Nhân viên" }] : []),
        { to: "/admin/cham-cong", label: "Chấm công" },
        { to: "/admin/luong", label: owner ? "Lương" : "Lương của tôi" },
        { to: "/admin/tai-khoan", label: "Tài khoản" },
      ]}
    />
  );
}

export function MoneyLinks() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (!me.data) return null;
  if (me.data.role !== "owner") {
    return (
      <SectionLinks
        label="Tài chính"
        items={[
          { to: "/admin/thu", label: "Thu tiền" },
          { to: "/admin/vi", label: "Ví tiền" },
          { to: "/admin/kpi", label: "KPI" },
        ]}
      />
    );
  }
  return (
    <SectionLinks
      label="Tài chính"
      items={[
        { to: "/admin/thu", label: "Thu tiền" },
        { to: "/admin/chi-phi", label: "Chi phí" },
        { to: "/admin/vi", label: "Ví tiền" },
        { to: "/admin/bao-cao-chi", label: "Báo cáo chi" },
        { to: "/admin/loi-nhuan", label: "Lợi nhuận" },
        { to: "/admin/bao-cao", label: "Báo cáo" },
        { to: "/admin/kpi", label: "KPI" },
      ]}
    />
  );
}
