import { notFound, redirect } from "next/navigation";
import { ProductExperience } from "@/components/product/ProductExperience";
import {
  catalog,
  formatMoney,
  productPath,
  products,
  resolveProductSlug,
} from "@/lib/catalog";
import { PRESALE } from "@/lib/presale";
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
  return {
    title: `Mora ${model.name}`,
    description: `${model.promise} ${model.material}. Preventa: entrega el ${PRESALE.deliveryFull}. Desde ${formatMoney(model.price)}.`,
    alternates: { canonical: productPath(modelId) },
    openGraph: {
      title: `Mora ${model.name}`,
      description: `${model.promise} ${PRESALE.promise}`,
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
