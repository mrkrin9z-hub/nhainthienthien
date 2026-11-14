import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";

const Toaster = lazy(() => import("@/components/ui/sonner").then((mod) => ({ default: mod.Toaster })));

const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Nunito+Sans:wght@400;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=optional";

import appCss from "../styles.css?url";
import { installMotion } from "../lib/motion";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { publicConfigQueryOptions, type PublicConfig } from "@/lib/catalog.functions";
import { BRAND } from "@/lib/brand";
import { telE164 } from "@/domain/public-contact";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicConfigQueryOptions),
  head: ({ matches, loaderData }) => {
    const path = matches[matches.length - 1]?.pathname ?? "/";
    const admin = path.startsWith("/admin");
    const links: Array<Record<string, string>> = [
      { rel: "icon", href: "/favicon.png?v=3", type: "image/png", sizes: "32x32" },
    ];
    if (!admin) {
      links.unshift(
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      );
      links.push(
        { rel: "icon", href: "/favicon.ico?v=3", sizes: "any" },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "apple-touch-icon", href: "/brand/apple-touch-icon.png?v=2" },
      );
    }
    const contact = loaderData as PublicConfig | undefined;
    const telephone = contact?.showZalo && contact.phoneRaw ? telE164(contact.phoneRaw) : "";
    const scripts = admin
      ? []
      : [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: BRAND.name,
              url: `https://${BRAND.website}`,
              address: {
                "@type": "PostalAddress",
                streetAddress: "Số 67 Đường Ngô Quyền, Khu Phố 4",
                addressLocality: "Xuân Lộc",
                addressRegion: "Đồng Nai",
                addressCountry: "VN",
              },
              ...(telephone ? { telephone } : {}),
            }),
          },
        ];
    return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nhà In Thiên Thiên — In đẹp từng khoảnh khắc" },
      {
        name: "description",
        content: "In ảnh tráng gương 4K, thời khóa biểu, nam châm và ảnh lụa theo yêu cầu. Gửi ảnh online, theo dõi tiến trình trên web.",
      },
      { name: "author", content: "Nhà In Thiên Thiên" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Thiên Thiên" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "theme-color", content: "#f7f4ee" },
      { property: "og:title", content: "Nhà In Thiên Thiên — In đẹp từng khoảnh khắc" },
      {
        property: "og:description",
        content: "Gửi ảnh online 3 bước và theo dõi tiến trình trên web.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links,
    scripts,
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Trang khách: CSS chặn render để không chớp trang chưa có giao diện rồi nhảy bố cục (CLS).
  // Trang quản trị giữ cách tải CSS không chặn như cũ.
  const admin = useRouterState({ select: (state) => state.location.pathname.startsWith("/admin") });
  return (
    <html lang="vi">
      <head>
        <style>{`body{margin:0;background:#f7f4ee;color:#243044;font-family:ui-sans-serif,system-ui,sans-serif}`}</style>
        <link rel="stylesheet" href={appCss} data-app-css="1" {...(admin ? { media: "print" } : {})} />
        <HeadContent />
      </head>
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `for(const l of document.querySelectorAll('link[data-app-css]')){const go=()=>{l.media='all'};l.addEventListener('load',go);if(l.sheet)go()}if(location.pathname.startsWith('/admin')){}else{const l=document.createElement('link');l.rel='stylesheet';l.href=${JSON.stringify(FONT_STYLESHEET)};l.media='print';l.setAttribute('data-fonts','1');const go=()=>{l.media='all'};l.addEventListener('load',go);document.head.appendChild(l);if(l.sheet)go()}`,
          }}
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [toasts, setToasts] = useState(false);
  const router = useRouter();
  useEffect(() => {
    installMotion();
    // CSS trang quản trị tải không chặn (media=print); đổi trang bằng router thì bật lại ngay.
    const unsubCss = router.subscribe("onResolved", () => {
      for (const link of document.querySelectorAll<HTMLLinkElement>("link[data-app-css]")) link.media = "all";
    });
    if ("startViewTransition" in document) {
      // Chỉ dùng chuyển trang mượt cho các lần bấm sau, không áp cho lần tải đầu.
      const timer = window.setTimeout(() => {
        router.options.defaultViewTransition = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      }, 0);
      return () => {
        window.clearTimeout(timer);
        unsubCss();
      };
    }
    // Trình duyệt chưa có View Transitions: trượt nhẹ nội dung khi đổi trang.
    const unsubPage = router.subscribe("onResolved", (event) => {
      if (!event.pathChanged) return;
      const root = document.documentElement;
      root.classList.remove("page-enter");
      void root.offsetWidth;
      root.classList.add("page-enter");
      window.setTimeout(() => root.classList.remove("page-enter"), 400);
    });
    return () => {
      unsubCss();
      unsubPage();
    };
  }, [router]);
  useEffect(() => {
    const link = document.querySelector("link[data-fonts]");
    if (link instanceof HTMLLinkElement) link.media = "all";
    const show = () => setToasts(true);
    const toastTimer = window.setTimeout(show, 8000);
    window.addEventListener("pointerdown", show, { once: true });
    const workerTimer = window.setTimeout(() => {
      if (!("serviceWorker" in navigator)) return;
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, 8000);
    return () => {
      window.clearTimeout(toastTimer);
      window.clearTimeout(workerTimer);
      window.removeEventListener("pointerdown", show);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {toasts ? (
        <Suspense fallback={null}>
          <Toaster position="top-center" richColors offset={72} mobileOffset={{ top: "4.5rem" }} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  );
}
