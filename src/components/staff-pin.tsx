import { useEffect, useState } from "react";

const KEY = "tt-staff-pin";

export function readStaffPin(): string {
  if (typeof sessionStorage === "undefined") return "";
  const saved = sessionStorage.getItem(KEY) ?? "";
  return /^\d{4}$/.test(saved) ? saved : "";
}

export function useStaffPin() {
  const [pin, setPin] = useState("");
  useEffect(() => {
    setPin(readStaffPin());
  }, []);
  function save(next: string) {
    sessionStorage.setItem(KEY, next);
    setPin(next);
  }
  function clear() {
    sessionStorage.removeItem(KEY);
    setPin("");
  }
  return { pin, save, clear };
}
