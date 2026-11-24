import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OrderDesk, type DeskSku } from "../components/admin/order-desk.tsx";
import { ProductPickerDialog, ProductPickerPanel } from "../components/admin/product-picker.tsx";
import { applyPickerSelectionToLines } from "./desk-lines.ts";
import type { Channel, PaymentMethod } from "./types.ts";

const catalog: DeskSku[] = [
  {
    id: "AT-20x30-C1",
    code: "AT-20x30-C1",
    name: "20×30 cm",
    groupName: "Ảnh thờ ép gỗ",
    label: "AT-20x30-C1 · Ảnh thờ ép gỗ · 20×30 cm",
    prices: { tai_tiem: 56000, facebook: 56000, tiktok: 56000, shopee: 56000 },
    soldOn: ["tai_tiem", "facebook", "tiktok", "shopee"],
  },
  {
    id: "TG-13x18-C1",
    code: "TG-13x18-C1",
    name: "13×18 cm",
    groupName: "Ảnh ép gỗ tráng gương",
    label: "TG-13x18-C1 · Ảnh ép gỗ tráng gương · 13×18 cm",
    prices: { tai_tiem: 35000 },
    soldOn: ["tai_tiem"],
  },
];

const client = () => new QueryClient({ defaultOptions: { queries: { enabled: false } } });

function renderDesk(props: Parameters<typeof OrderDesk>[0]) {
  return renderToString(h(QueryClientProvider, { client: client() }, h(OrderDesk, props)));
}

const tt261124 = {
  channel: "tai_tiem" as Channel,
  fullName: "Ccccv",
  phone: "0365677301",
  address: "",
  fulfillment: "pickup" as const,
  note: "",
  dueDate: "",
  marketplaceCode: "",
  discount: null as number | null,
  customerShip: null as number | null,
  shipBy: "",
  designFileUrl: "",
  paymentMethod: "tien_mat" as PaymentMethod,
  lines: [
    {
      key: "8b898740-7519-43ae-9c96-9e20902bc2fe",
      skuId: "AT-20x30-C1",
      quantity: 1,
      variant: "",
      unitPrice: "56000",
      discount: 0 as number,
    },
  ],
};

test("render OrderDesk đơn TT261124-001 (thiếu item.discount) không văng ReferenceError", () => {
  const html = renderDesk({
    mode: "edit",
    owner: true,
    fieldsLocked: false,
    itemsLocked: false,
    lockNote: "",
    catalog,
    retail: true,
    paidSoFar: 0,
    payments: [],
    transfer: null,
    initial: tt261124,
    onSave: async () => {},
  });
  assert.match(html, /Ảnh thờ ép gỗ/);
  assert.match(html, /AT-20x30-C1/);
  assert.match(html, /56\.000đ/);
  assert.doesNotMatch(html, /This page didn't load/);
  assert.doesNotMatch(html, /Lý do sửa giá/);
  assert.doesNotMatch(html, /aria-label="Giảm giá"/);
  assert.match(html, /aria-label="Đơn giá dòng 1"/);
  assert.doesNotMatch(html, /<input[^>]*aria-label="Đơn giá dòng/);
  assert.match(html, /aria-label="Số lượng dòng 1"/);
  assert.match(html, /aria-label="Giảm giá dòng 1"/);
  assert.match(html, /Khách lấy tại tiệm/);
  assert.match(html, /min-w-0 max-w-full/);
});

test("tạo đơn: mở picker không throw, sau khi chọn sản phẩm thì OrderDesk hiện dòng mới", () => {
  assert.doesNotThrow(() =>
    renderToString(
      h(ProductPickerDialog, {
        open: true,
        onOpenChange: () => {},
        catalog,
        channel: "tai_tiem",
        onConfirm: () => {},
      }),
    ),
  );

  let n = 0;
  const lines = applyPickerSelectionToLines(
    [],
    [
      { skuId: "AT-20x30-C1", quantity: 2 },
      { skuId: "TG-13x18-C1", quantity: 1 },
    ],
    catalog,
    "tai_tiem",
    () => `line-${++n}`,
  );
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.quantity, 2);

  const html = renderDesk({
    mode: "create",
    owner: true,
    fieldsLocked: false,
    itemsLocked: false,
    lockNote: "",
    catalog,
    retail: true,
    paidSoFar: 0,
    initial: {
      channel: "tai_tiem",
      fullName: "",
      phone: "0961808884",
      address: "",
      fulfillment: "pickup",
      note: "",
      dueDate: "",
      marketplaceCode: "",
      paymentMethod: "tien_mat",
      lines: lines.map((line, index) => ({
        key: line.key,
        skuId: line.skuId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        variant: line.variant,
        discount: index === 0 ? "5000" : line.discount,
      })),
    },
    onSave: async () => {},
  });
  assert.match(html, /Ảnh thờ ép gỗ/);
  assert.match(html, /Ảnh ép gỗ tráng gương/);
  assert.match(html, /AT-20x30-C1/);
  assert.match(html, /TG-13x18-C1/);
  assert.match(html, /Thêm sản phẩm/);
  assert.match(html, /56\.000đ/);
  assert.match(html, /35\.000đ/);
  assert.doesNotMatch(html, /<input[^>]*aria-label="Đơn giá dòng/);
  assert.match(html, /Giảm giá sản phẩm/);
  assert.doesNotMatch(html, /aria-label="Giảm giá"/);
  assert.doesNotMatch(html, /Lý do sửa giá/);
  assert.match(html, /Khách lấy tại tiệm/);
});

test("panel modal hiện rõ 2 sản phẩm đã chọn kèm số lượng", () => {
  const html = renderToString(
    h(ProductPickerPanel, {
      catalog,
      channel: "tai_tiem",
      initialSelected: [
        { skuId: "AT-20x30-C1", quantity: 2 },
        { skuId: "TG-13x18-C1", quantity: 1 },
      ],
      onConfirm: () => {},
    }),
  );
  assert.match(html, /Sản phẩm/);
  assert.match(html, /Đã chọn · SL/);
  assert.match(html, /aria-label="Số lượng 20×30 cm">2</);
  assert.match(html, /aria-label="Số lượng 13×18 cm">1</);
  assert.match(html, /20×30 cm/);
  assert.match(html, /13×18 cm/);
  assert.match(html, /Xong \(2 sản phẩm · 147\.000đ\)/);
  assert.match(html, /Tất cả loại/);
  assert.match(html, /Gói dịch vụ/);
});
