/**
 * Đóng file tĩnh sau `npm run build` thành JSON cho `wrangler kv bulk put`.
 * Khóa = pathname (có dấu /). metadata.contentType để worker trả đúng loại file.
 *
 *   node scripts/pack-assets-kv.mjs
 *   npx wrangler kv bulk put .output/assets-kv.json --namespace-id <id ASSETS_KV>
 */
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".output/public");
const out = path.resolve(".output/assets-kv.json");

const TYPES = {
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

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return TYPES[ext] ?? "application/octet-stream";
}

async function walk(dir) {
  const found = [];
  for (const name of await readdir(dir)) {
    const absolute = path.join(dir, name);
    const info = await stat(absolute);
    if (info.isDirectory()) found.push(...(await walk(absolute)));
    else found.push(absolute);
  }
  return found;
}

const files = await walk(root);
const records = [];
for (const absolute of files) {
  const rel = path.relative(root, absolute).split(path.sep).join("/");
  const key = `/${rel}`;
  const bytes = await readFile(absolute);
  records.push({
    key,
    value: bytes.toString("base64"),
    base64: true,
    metadata: { contentType: contentType(absolute) },
  });
}
await writeFile(out, JSON.stringify(records));
console.log(`Đã ghi ${records.length} khóa vào ${out}`);
