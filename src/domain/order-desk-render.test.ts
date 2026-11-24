import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OrderDesk, type DeskSku } from "../components/admin/order-desk.tsx";
import { ProductPickerDialog } from "../components/admin/product-picker.tsx";
import { addSkusToLines } from "./desk-lines.ts";
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
  assert.match(html, /56\.000/);
  assert.doesNotMatch(html, /This page didn't load/);
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
  const lines = addSkusToLines([], ["AT-20x30-C1", "TG-13x18-C1"], catalog, "tai_tiem", () => `line-${++n}`);
  assert.equal(lines.length, 2);

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
      lines: lines.map((line) => ({
        key: line.key,
        skuId: line.skuId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        variant: line.variant,
        discount: line.discount,
      })),
    },
    onSave: async () => {},
  });
  assert.match(html, /Ảnh thờ ép gỗ/);
  assert.match(html, /Ảnh ép gỗ tráng gương/);
  assert.match(html, /AT-20x30-C1/);
  assert.match(html, /TG-13x18-C1/);
  assert.match(html, /Thêm sản phẩm/);
});
