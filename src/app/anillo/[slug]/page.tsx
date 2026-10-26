import { notFound, redirect } from "next/navigation";
import { ProductExperience } from "@/components/product/ProductExperience";
import { BreadcrumbJsonLd, ProductJsonLd } from "@/components/seo/JsonLd";
import {
  catalog,
  formatMoney,
  PRODUCT_HOME,
  productPath,
  products,
  resolveProductSlug,
} from "@/lib/catalog";
import { FALLBACK_SALES } from "@/commerce/sales";
import { siteUrl } from "@/lib/site";
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
  const home = PRODUCT_HOME[modelId];
  const sales = FALLBACK_SALES;
  const path = productPath(modelId);
  const delivery = sales.deliveryFull
    ? `Preventa: entrega el ${sales.deliveryFull}.`
    : sales.promise;
  return {
    title: `Mora ${model.name}`,
    description: `${model.promise} ${model.material}. ${delivery} ${formatMoney(model.price)}.`,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: siteUrl(path),
      title: `Mora ${model.name}`,
      description: `${model.promise} ${sales.promise}`,
      images: [{ url: home.src, width: home.width, height: home.height, alt: home.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Mora ${model.name}`,
      description: `${model.promise} ${sales.promise}`,
      images: [home.src],
    },
  };
}

export default async function AnilloPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ color?: string }>;
}) {
  const { slug } = await params;
  const { color } = await searchParams;
  const modelId = resolveProductSlug(slug);
  if (!modelId) notFound();
  if (slug !== products[modelId].slug) {
    redirect(productPath(modelId));
  }
  const descriptions = await getProductDescriptions();
  const model = products[modelId];
  return (
    <>
      <ProductJsonLd modelId={modelId} sales={FALLBACK_SALES} />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: `Mora ${model.name}`, path: productPath(modelId) },
        ]}
      />
      <ProductExperience
        modelId={modelId}
        description={descriptions[modelId]}
        color={typeof color === "string" ? color : null}
      />
    </>
  );
}
