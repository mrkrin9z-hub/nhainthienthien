import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { customerUploadPath } from "@/domain/order-upload";
import { orderUploadLink } from "@/lib/admin.functions";

/** Mã khách gửi ảnh, luôn hiện trên đơn. Cùng token với phiếu in. */
export function OrderUploadCard({ orderId, code, cancelled }: { orderId: string; code: string; cancelled?: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    void orderUploadLink({ data: { orderId, rotate: false } })
      .then((result) => {
        if (!cancel) setToken(result.slug);
      })
      .catch((error: Error) => {
        if (!cancel) toast.error(error.message);
      });
    return () => {
      cancel = true;
    };
  }, [orderId]);
  const link = token && typeof window !== "undefined" ? `${window.location.origin}${customerUploadPath(token)}` : "";
  useEffect(() => {
    if (!link) return;
    let cancel = false;
    void import("qrcode").then((QR) => {
      void QR.toDataURL(link, { width: 280, margin: 1, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancel) setImage(url);
      });
    });
    return () => {
      cancel = true;
    };
  }, [link]);
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3">
      {image ? <img src={image} alt={`Mã QR khách gửi ảnh cho đơn ${code}`} width={112} height={112} className="h-28 w-28" /> : <div className="grid h-28 w-28 place-items-center text-xs text-muted-foreground">Đang tạo mã…</div>}
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-semibold text-primary">Khách gửi ảnh</h2>
        <p className="text-xs text-muted-foreground">{cancelled ? "Đơn đã hủy, link không nhận thêm ảnh." : "Khách mở link hoặc quét mã, không cần đăng nhập. Ảnh vào thư mục đơn."}</p>
        {link ? <p className="break-all font-mono text-sm font-semibold text-primary">{link}</p> : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-9"
          disabled={!link}
          onClick={() => {
            void navigator.clipboard.writeText(link).then(
              () => toast.success("Đã chép link gửi ảnh"),
              () => toast.error("Không chép được"),
            );
          }}
        >
          Chép link
        </Button>
      </div>
    </section>
  );
}

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
  const [staffToken, setStaffToken] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [staffImage, setStaffImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const link = token && typeof window !== "undefined" ? `${window.location.origin}${customerUploadPath(token)}` : "";
  const staffLink = staffToken && typeof window !== "undefined" ? `${window.location.origin}/q/don/${staffToken}` : "";

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setBusy(true);
    void orderUploadLink({ data: { orderId, rotate: false } })
      .then((result) => {
        if (!cancel) {
          setToken(result.slug);
          setStaffToken(result.token);
        }
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
    void import("qrcode").then((QR) => {
      void QR.toDataURL(link, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancel) setImage(url);
      });
      if (staffLink) {
        void QR.toDataURL(staffLink, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then((url) => {
          if (!cancel) setStaffImage(url);
        });
      }
    });
    return () => {
      cancel = true;
    };
  }, [link, staffLink]);

  async function rotate() {
    if (!window.confirm("Mã cũ sẽ hết hạn. Khách đã nhận mã cũ sẽ không gửi được.")) return;
    setBusy(true);
    try {
      const result = await orderUploadLink({ data: { orderId, rotate: true } });
      setToken(result.slug);
      setStaffToken(result.token);
      setImage(null);
      setStaffImage(null);
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
          Khách quét mã đầu để gửi ảnh gốc. Nhân viên quét mã thứ hai, nhập PIN, gửi ảnh thiết kế, ảnh duyệt hoặc ảnh đóng gói.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="text-center">
            {image ? (
              <img src={image} alt={`Mã QR khách gửi ảnh cho đơn ${code}`} width={220} height={220} className="mx-auto h-auto w-[220px] max-w-full" />
            ) : (
              <p className="grid h-[220px] place-items-center text-sm text-muted-foreground">{busy ? "Đang tạo mã…" : "Chưa có mã"}</p>
            )}
            <p className="text-sm font-semibold">Khách gửi ảnh</p>
          </div>
          <div className="text-center">
            {staffImage ? (
              <img src={staffImage} alt={`Mã QR nhân viên gửi ảnh thiết kế cho đơn ${code}`} width={220} height={220} className="mx-auto h-auto w-[220px] max-w-full" />
            ) : (
              <p className="grid h-[220px] place-items-center text-sm text-muted-foreground">{busy ? "Đang tạo mã…" : "Chưa có mã"}</p>
            )}
            <p className="text-sm font-semibold">Gửi ảnh thiết kế</p>
          </div>
        </div>
        {link ? <p className="break-all font-mono text-sm font-semibold text-primary">{link}</p> : null}
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
