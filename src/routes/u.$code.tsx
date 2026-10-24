import { createFileRoute } from "@tanstack/react-router";

import { CustomerUploadScreen } from "./gui-anh.$token";

export const Route = createFileRoute("/u/$code")({
  head: () => ({
    meta: [
      { title: "Gửi ảnh đặt in | Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShortUploadPage,
});

function ShortUploadPage() {
  const { code } = Route.useParams();
  return <CustomerUploadScreen token={code} />;
}
