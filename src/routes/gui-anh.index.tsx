import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { albumPhone, photoLimitLabel, photoTooBig } from "@/domain/order-upload";
import { createAlbumTicket } from "@/lib/orders.functions";
import { uploadViaDriveOrProxy } from "@/lib/upload-client";

export const Route = createFileRoute("/gui-anh/")({
  component: SharedUploadPage,
});

function SharedUploadPage() {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    const name = customerName.trim();
    if (name.length < 2) {
      toast.error("Nhập họ tên của bạn.");
      return;
    }
    let digits: string;
    try {
      digits = albumPhone(phone);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Số điện thoại chưa đúng.");
      return;
    }
    const files = [...list];
    if (files.some((file) => photoTooBig(file.size))) {
      toast.error(`Mỗi ảnh tối đa ${photoLimitLabel()}.`);
      return;
    }
    setBusy(true);
    let ok = 0;
    try {
      for (const file of files) {
        const ticket = await createAlbumTicket({
          data: {
            phone: digits,
            customerName: name,
            fileName: file.name,
            mimeType: file.type || "image/jpeg",
            sizeBytes: file.size,
          },
        });
        await uploadViaDriveOrProxy({
          file,
          prepareDrive: async () => {
            const { prepareAlbumDriveUpload } = await import("@/lib/orders.functions");
            return prepareAlbumDriveUpload({ data: { albumId: ticket.albumId, phone: digits, fileId: ticket.fileId } });
          },
          finishDrive: async (driveFileId) => {
            const { finishAlbumDriveUpload } = await import("@/lib/orders.functions");
            await finishAlbumDriveUpload({
              data: { albumId: ticket.albumId, phone: digits, fileId: ticket.fileId, driveFileId },
            });
          },
          uploadLocal: async () => {
            const body = new FormData();
            body.set("albumId", ticket.albumId);
            body.set("phone", digits);
            body.set("fileId", ticket.fileId);
            body.set("file", file);
            const response = await fetch("/api/album-upload", { method: "POST", body });
            if (!response.ok) throw new Error((await response.text()) || "Upload lỗi");
          },
        });
        ok += 1;
        setDone(ok);
      }
      toast.success(`Đã gửi ${ok} ảnh. Xưởng sẽ xem theo tên và số điện thoại của bạn.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gửi ảnh lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 py-8">
      <div>
        <p className="text-sm font-semibold text-primary">Nhà In Thiên Thiên</p>
        <h1 className="text-2xl font-extrabold text-primary">Gửi ảnh in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nhập họ tên, số điện thoại và chọn ảnh. Xưởng nhận ảnh theo tên và SĐT — chưa cần tạo đơn.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="customer-name">Họ tên</Label>
        <Input
          id="customer-name"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="Nguyễn Văn A"
          autoComplete="name"
          className="min-h-12 text-base"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Số điện thoại</Label>
        <Input
          id="phone"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="0901 234 567"
          autoComplete="tel"
          className="min-h-12 text-base"
        />
      </div>
      <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-card px-4 py-8 text-center">
        <span className="font-semibold text-primary">{busy ? "Đang gửi…" : "Chọn ảnh từ máy"}</span>
        <span className="text-xs text-muted-foreground">JPG, PNG, WEBP — mỗi ảnh tối đa {photoLimitLabel()}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={(event) => {
            void onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      {done > 0 ? <p className="text-sm font-medium text-emerald-700">Đã gửi {done} ảnh trong phiên này.</p> : null}
      <p className="text-center text-xs text-muted-foreground">
        Đã có mã đơn?{" "}
        <Link to="/tra-cuu" className="font-semibold text-primary underline-offset-2 hover:underline">
          Tra cứu đơn
        </Link>
      </p>
    </main>
  );
}
