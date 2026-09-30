import { AdminShell } from "@/components/admin/AdminShell";
import type { ReactNode } from "react";
import "../admin.css";

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mora-admin">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
