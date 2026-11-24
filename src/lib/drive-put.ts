const CHUNK = 8 * 1024 * 1024;

export type UploadProgress = (loaded: number, total: number) => void;

/** Gửi nguyên file lên phiên Drive. Mỗi phần trừ phần cuối là bội của 256KB. */
export async function putDriveFile(uploadUrl: string, file: File, mime: string, onProgress?: UploadProgress): Promise<string> {
  let start = 0;
  onProgress?.(0, file.size || 1);
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
      onProgress?.(Math.min(start, file.size), file.size || 1);
      continue;
    }
    if (!res.ok) throw new Error("Không tải được ảnh lên Drive.");
    onProgress?.(file.size, file.size || 1);
    const json = (await res.json()) as { id?: string };
    if (!json.id) throw new Error("Drive không trả mã file.");
    return json.id;
  }
  throw new Error("Không tải được ảnh lên Drive.");
}

/** POST multipart với thanh tiến độ (XMLHttpRequest). */
export function postFormWithProgress(url: string, body: FormData, onProgress?: UploadProgress): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Mạng đứng (không nhích) quá 60 giây thì báo lỗi để khách bấm gửi lại, không quay mãi.
    let stall = 0;
    const arm = () => {
      window.clearTimeout(stall);
      stall = window.setTimeout(() => xhr.abort(), 60_000);
    };
    const done = () => window.clearTimeout(stall);
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      arm();
      if (!event.lengthComputable) return;
      onProgress?.(event.loaded, event.total || 1);
    };
    xhr.onload = () => {
      done();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1, 1);
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : undefined);
        } catch {
          resolve(undefined);
        }
        return;
      }
      reject(new Error(xhr.responseText || "Không tải được ảnh."));
    };
    xhr.onerror = () => {
      done();
      reject(new Error("Mất kết nối mạng khi tải ảnh"));
    };
    xhr.onabort = () => {
      done();
      reject(new Error("Mạng chậm quá, ảnh chưa tải lên được"));
    };
    arm();
    xhr.send(body);
  });
}
