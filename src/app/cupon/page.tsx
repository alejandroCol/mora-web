import type { Metadata } from "next";
import { CouponCard } from "@/components/checkout/CouponCard";

export const metadata: Metadata = {
  title: "Tu código de descuento",
  robots: { index: false, follow: false },
};

/** A donde lleva «Copiar código» del correo: un correo no puede copiar al portapapeles. */
export default async function CuponPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; p?: string }>;
}) {
  const { c, p } = await searchParams;
  const code = (c ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24);
  const session = (p ?? "").trim().slice(0, 80);
  return (
    <div className="min-h-dvh bg-[#f5f5f7] px-4 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-16">
      <CouponCard code={code} session={session} />
    </div>
  );
}
