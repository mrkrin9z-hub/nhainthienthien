import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 20_000, refetchOnWindowFocus: false },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 15_000,
    // Tải trước trang khi rê chuột / chạm vào link để bấm là mở ngay.
    defaultPreload: "intent",
    defaultPreloadDelay: 40,
    // Chuyển trang mượt (View Transitions); trình duyệt không hỗ trợ thì dùng hiệu ứng CSS ở styles.css.
    defaultViewTransition: true,
  });

  return router;
};
