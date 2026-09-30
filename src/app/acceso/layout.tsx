import type { ReactNode } from "react";
import "../admin.css";

export default function AccesoLayout({ children }: { children: ReactNode }) {
  return <div className="mora-admin min-h-dvh">{children}</div>;
}
