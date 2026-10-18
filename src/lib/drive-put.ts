const CHUNK = 8 * 1024 * 1024;

/** Gửi nguyên file lên phiên Drive. Mỗi phần trừ phần cuối là bội của 256KB. */
export async function putDriveFile(uploadUrl: string, file: File, mime: string): Promise<string> {
  let start = 0;
  while (start < file.size) {
    const end = Math.min(file.size, start + CHUNK);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": `bytes ${start}-${end - 1}/${file.size}`,
        "Content-Type": mime || "application/octet-stream",
      },
      body: file.slice(start, end),
    });
    if (res.status === 308) {
      const range = res.headers.get("Range");
      const received = range?.match(/-(\d+)/);
      start = received ? Number(received[1]) + 1 : end;
      continue;
    }
    if (!res.ok) throw new Error("Không tải được ảnh lên Drive.");
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("Drive không trả mã file.");
    return json.id;
  }
  throw new Error("Không tải được ảnh lên Drive.");
}
