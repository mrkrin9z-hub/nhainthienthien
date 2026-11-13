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
    // View Transitions bật sau lần tải đầu (xem __root.tsx), để lần mở trang đầu không bị nhảy bố cục (CLS).
    defaultViewTransition: false,
  });

  return router;
};
