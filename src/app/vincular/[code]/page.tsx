import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand/BrandLogo";

const CODE = /^[A-HJ-NP-Z2-9]{10}$/i;

export const metadata: Metadata = {
  title: "Vínculo",
  robots: { index: false, follow: false },
};

export default async function VincularPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!CODE.test(code)) notFound();
  const token = code.toUpperCase();
  const open = `mora://vincular/${token}`;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f6f1fb] px-6 py-16">
      <section className="w-full max-w-sm rounded-[28px] bg-white/85 px-8 py-10 text-center shadow-[0_24px_60px_rgba(56,41,97,0.08)]">
        <BrandLogo className="mx-auto h-16 w-16" priority />
        <h1 className="mt-6 font-display text-3xl font-semibold text-[#382961]">Un vínculo</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#6d6484]">
          Ábrelo en Mora con tu cuenta. Quedan cerca, sin invitación.
        </p>
        <a
          href={open}
          className="mt-8 inline-flex rounded-full bg-[#6B61B3] px-6 py-3 text-[15px] font-semibold text-white"
        >
          Abrir en Mora
        </a>
        <a href="/descargas" className="mt-4 block text-sm font-medium text-[#6B61B3]">
          Si aún no tienes la app
        </a>
      </section>
    </main>
  );
}
