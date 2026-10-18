import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customerUploadPath } from "@/domain/order-upload";
import { orderUploadLink } from "@/lib/admin.functions";

export function OrderQrDialog({
  open,
  onOpenChange,
  orderId,
  code,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  code: string;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const link = token && typeof window !== "undefined" ? `${window.location.origin}${customerUploadPath(token)}` : "";

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setBusy(true);
    void orderUploadLink({ data: { orderId, rotate: false } })
      .then((result) => {
        if (!cancel) setToken(result.token);
      })
      .catch((error: Error) => {
        if (!cancel) toast.error(error.message);
      })
      .finally(() => {
        if (!cancel) setBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, [open, orderId]);

  useEffect(() => {
    if (!link) return;
    let cancel = false;
    void import("qrcode").then((QR) =>
      QR.toDataURL(link, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancel) setImage(url);
      }),
    );
    return () => {
      cancel = true;
    };
  }, [link]);

  async function rotate() {
    if (!window.confirm("Mã cũ sẽ hết hạn. Khách đã nhận mã cũ sẽ không gửi được.")) return;
    setBusy(true);
    try {
      const result = await orderUploadLink({ data: { orderId, rotate: true } });
      setToken(result.token);
      setImage(null);
      toast.success("Đã đổi mã");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mã gửi ảnh · {code}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Khách quét mã này để gửi ảnh gốc vào đúng đơn {code}. Ảnh hiện ở mục Ảnh khách.
        </p>
        <div className="flex justify-center">
          {image ? (
            <img src={image} alt={`Mã QR gửi ảnh cho đơn ${code}`} width={280} height={280} className="h-auto w-[280px] max-w-full" />
          ) : (
            <p className="grid h-[280px] place-items-center text-sm text-muted-foreground">{busy ? "Đang tạo mã…" : "Chưa có mã"}</p>
          )}
        </div>
        {link ? <p className="break-all text-xs text-muted-foreground">{link}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11"
            disabled={!link}
            onClick={() => {
              void navigator.clipboard.writeText(link).then(
                () => toast.success("Đã chép liên kết"),
                () => toast.error("Không chép được"),
              );
            }}
          >
            Chép liên kết
          </Button>
          {image ? (
            <Button asChild type="button" variant="outline" className="min-h-11">
              <a href={image} download={`qr-${code}.png`}>
                Tải mã QR
              </a>
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void rotate()}>
            Đổi mã
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
