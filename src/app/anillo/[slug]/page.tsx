import { notFound, redirect } from "next/navigation";
import { ProductExperience } from "@/components/product/ProductExperience";
import {
  catalog,
  formatMoney,
  productPath,
  products,
  resolveProductSlug,
} from "@/lib/catalog";
import { FALLBACK_SALES } from "@/commerce/sales";
import { getProductDescriptions } from "@/server/productCopy";

export function generateStaticParams() {
  return catalog.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const modelId = resolveProductSlug(slug);
  if (!modelId) return { title: "Anillo" };
  const model = products[modelId];
  const sales = FALLBACK_SALES;
  const delivery = sales.deliveryFull
    ? `Preventa: entrega el ${sales.deliveryFull}.`
    : sales.promise;
  return {
    title: `Mora ${model.name}`,
    description: `${model.promise} ${model.material}. ${delivery} Desde ${formatMoney(model.price)}.`,
    alternates: { canonical: productPath(modelId) },
    openGraph: {
      title: `Mora ${model.name}`,
      description: `${model.promise} ${sales.promise}`,
    },
  };
}

export default async function AnilloPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const modelId = resolveProductSlug(slug);
  if (!modelId) notFound();
  if (slug !== products[modelId].slug) {
    redirect(productPath(modelId));
  }
  const descriptions = await getProductDescriptions();
  return <ProductExperience modelId={modelId} description={descriptions[modelId]} />;
}
