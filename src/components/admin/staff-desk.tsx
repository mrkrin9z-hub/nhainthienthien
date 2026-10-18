import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABEL, type Role } from "@/domain/types";
import { loadSettings, storeStaff } from "@/lib/admin.functions";

const ROLES: { role: Role; detail: string }[] = [
  { role: "owner", detail: "Toàn bộ sổ: ví, chi phí, cài đặt, nhân viên, giá vốn." },
  { role: "sale", detail: "Đơn, khách, giá bán, thu tiền, KPI. Không ví, không chi phí, không giá vốn." },
  { role: "production", detail: "In, đóng gói, giao, kho, chấm công. Không thấy giá và doanh thu." },
];

type Person = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  probation: boolean;
  hiredAt: string | null;
};

const empty = {
  id: "",
  name: "",
  email: "",
  password: "",
  role: "sale" as Role,
  active: true,
  probation: false,
  hiredAt: null as string | null,
};

export function StaffDesk() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => loadSettings() });
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(empty);
  const rows = (settings.data?.staff ?? []) as Person[];
  const editing = Boolean(form.id);

  function openNew() {
    setForm(empty);
    setOpen(true);
  }

  function openEdit(person: Person) {
    setForm({
      id: person.id,
      name: person.name,
      email: person.email,
      password: "",
      role: person.role,
      active: person.active,
      probation: person.probation,
      hiredAt: person.hiredAt,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={openNew}>
        <Plus className="mr-1 size-4" />
        Thêm nhân viên
      </Button>
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((person) => (
              <TableRow key={person.id} className="cursor-pointer" onClick={() => openEdit(person)}>
                <TableCell>{person.name}</TableCell>
                <TableCell className="text-xs">{person.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px]">
                    {ROLE_LABEL[person.role]}
                  </Badge>
                  {person.probation ? <span className="ml-2 text-xs text-muted-foreground">Thử việc</span> : null}
                </TableCell>
                <TableCell>
                  <Badge variant={person.active ? "default" : "secondary"}>{person.active ? "Đang làm" : "Nghỉ"}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {settings.data && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Chưa có nhân viên
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa nhân viên" : "Thêm nhân viên"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!editing && form.password.trim().length < 8) {
                toast.error("Mật khẩu cần ít nhất 8 ký tự.");
                return;
              }
              if (editing && form.password && form.password.trim().length < 8) {
                toast.error("Mật khẩu cần ít nhất 8 ký tự.");
                return;
              }
              setSaving(true);
              try {
                await storeStaff({
                  data: {
                    ...(form.id ? { id: form.id } : {}),
                    name: form.name,
                    email: form.email,
                    role: form.role,
                    ...(form.password ? { password: form.password } : {}),
                    probation: form.probation,
                    active: form.active,
                    hiredAt: form.hiredAt,
                  },
                });
                toast.success(editing ? "Đã cập nhật nhân viên" : "Đã tạo nhân viên và tài khoản");
                setOpen(false);
                await queryClient.invalidateQueries({ queryKey: ["settings"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Họ tên</Label>
                <Input className="mt-1" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required minLength={2} />
              </div>
              <div>
                <Label>Email đăng nhập</Label>
                <Input className="mt-1" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
              </div>
              <div className="sm:col-span-2">
                <Label>{editing ? "Đặt lại mật khẩu" : "Mật khẩu"}</Label>
                <Input
                  className="mt-1"
                  type="password"
                  value={form.password}
                  placeholder={editing ? "Để trống nếu giữ mật khẩu cũ" : "Ít nhất 8 ký tự"}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  required={!editing}
                  minLength={editing ? undefined : 8}
                />
              </div>
            </div>

            <div className="space-y-2 border-t pt-3">
              <Label>Phân quyền</Label>
              <div className="space-y-2">
                {ROLES.map((item) => (
                  <label key={item.role} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio"
                      className="mt-1"
                      name="staff-role"
                      checked={form.role === item.role}
                      onChange={() => setForm((current) => ({ ...current, role: item.role }))}
                    />
                    <span>
                      <span className="font-medium">{ROLE_LABEL[item.role]}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Mỗi người một vai trò. Đổi quyền có hiệu lực ở lần tải trang sau.</p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.probation} onChange={(event) => setForm((current) => ({ ...current, probation: event.target.checked }))} />
              Thử việc
            </label>
            {editing ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                Đang làm việc
              </label>
            ) : null}

            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
