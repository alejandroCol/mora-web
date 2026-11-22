import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedCartView } from "@/components/cart/SharedCartView";
import { getSharedCart } from "@/server/sharedCarts";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const shared = await getSharedCart(code).catch(() => null);
  if (!shared) {
    return { title: "Pedido no encontrado", robots: { index: false, follow: false } };
  }
  return {
    title: "Un pedido compartido",
    description: "Te compartieron un pedido de Mora. Ábrelo y termínalo cuando quieras.",
    robots: { index: false, follow: false },
    openGraph: {
      title: "Te compartieron un pedido de Mora",
      description: "Ábrelo y termínalo cuando quieras.",
    },
  };
}

export default async function SharedCartPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const shared = await getSharedCart(code).catch(() => null);
  if (!shared) notFound();
  return <SharedCartView items={shared.items} />;
}
