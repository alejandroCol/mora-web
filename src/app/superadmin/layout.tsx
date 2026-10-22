import { AdminShell } from "@/components/admin/AdminShell";
import type { ReactNode } from "react";
import type { Viewport } from "next";
import "../admin.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mora-admin">
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
