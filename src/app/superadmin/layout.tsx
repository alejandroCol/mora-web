import { AdminShell } from "@/components/admin/AdminShell";
import type { ReactNode } from "react";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
