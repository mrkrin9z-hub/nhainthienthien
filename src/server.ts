import "./lib/error-capture";

import { staticAssetPath } from "./domain/guard";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { assetsKv, type AssetsKv } from "./server/bindings";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

const STATIC_TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
};

function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  return STATIC_TYPES[path.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Khi không có binding ASSETS (API upload static không dùng được), phục vụ file build
 * từ KV. Khóa = pathname (có dấu /). Không trả index cho `/` để SSR giữ trang chủ.
 * Binding đọc từ `cloudflare:workers`, không từ tham số env của fetch.
 */
async function assetsFromKv(request: Request, kv: AssetsKv): Promise<Response | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  let pathname = "";
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return null;
  }
  const key = staticAssetPath(pathname);
  if (!key) return null;
  pathname = key;
  let body: ArrayBuffer | null = null;
  let contentType = contentTypeFor(pathname);
  try {
    if (typeof kv.getWithMetadata === "function") {
      const got = await kv.getWithMetadata(pathname, "arrayBuffer");
      body = got?.value ?? null;
      if (got?.metadata?.contentType) contentType = got.metadata.contentType;
    } else {
      body = await kv.get(pathname, "arrayBuffer");
    }
  } catch {
    return null;
  }
  if (!body) return null;
  const headers = {
    "content-type": contentType,
    "cache-control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
  };
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(body, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const kv = await assetsKv();
      if (kv) {
        const staticFile = await assetsFromKv(request, kv);
        if (staticFile) return staticFile;
      }
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
