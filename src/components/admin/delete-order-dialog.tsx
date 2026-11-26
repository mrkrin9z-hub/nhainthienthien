import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteDeskOrder } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";

export function DeleteOrderDialog({
  orderId,
  orderCode,
  compact = false,
  onDeleted,
}: {
  orderId: string;
  orderCode: string;
  compact?: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteDeskOrder({ data: { orderId, orderCode } });
      toast.success(`Đã xóa đơn ${orderCode}`);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order", orderCode] });
      onDeleted?.();
      if (!onDeleted) {
        void router.navigate({ to: "/admin/don-hang" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xóa được đơn.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={compact ? "ghost" : "outline"}
        className={cn(
          compact
            ? "h-11 shrink-0 px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            : "min-h-11 border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800",
        )}
        disabled={deleting}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {deleting ? "Đang xóa…" : "Xóa đơn"}
      </Button>
      <AlertDialog open={open} onOpenChange={(next) => { if (!deleting) setOpen(next); }}>
        <AlertDialogContent
          onClick={(event) => event.stopPropagation()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa đơn {orderCode}?</AlertDialogTitle>
            <AlertDialogDescription>
              Đơn <span className="font-semibold text-foreground">{orderCode}</span> sẽ bị xóa hẳn khỏi hệ thống. Không hoàn tác. Ảnh đính kèm theo đơn cũng mất liên kết trên sổ đơn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Giữ lại</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? "Đang xóa…" : `Xóa đơn ${orderCode}`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
