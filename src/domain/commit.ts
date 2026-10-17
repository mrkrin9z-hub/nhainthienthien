/**
 * Ghi sổ theo phiên bản: đọc bản hiện tại, sửa bản sao, chỉ ghi khi version
 * vẫn đúng. Nếu người khác ghi trước thì thử lại từ đầu, không đè dữ liệu cũ.
 */
export async function commitLoop<T, S extends { version: number }>(options: {
  read: () => Promise<S>;
  write: (next: S, expectedVersion: number) => Promise<boolean>;
  run: (draft: S) => Promise<T> | T;
  attempts?: number;
}): Promise<T> {
  const attempts = options.attempts ?? 5;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const current = await options.read();
    const expected = current.version;
    const draft = structuredClone(current);
    const result = await options.run(draft);
    draft.version = expected + 1;
    const saved = await options.write(draft, expected);
    if (saved) return result;
  }
  throw new Error("Sổ đang được người khác sửa. Thử lại.");
}
