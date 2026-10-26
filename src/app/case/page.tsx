import { CaseExperience } from "@/components/product/CaseExperience";
import { BreadcrumbJsonLd, CaseJsonLd } from "@/components/seo/JsonLd";
import { CASE_PRODUCT, casePath } from "@/lib/cases";
import { formatMoney } from "@/lib/catalog";
import { FALLBACK_SALES } from "@/commerce/sales";
import { siteUrl } from "@/lib/site";

export function generateMetadata() {
  const sales = FALLBACK_SALES;
  return {
    title: `Mora ${CASE_PRODUCT.name}`,
    description: `${CASE_PRODUCT.promise} ${CASE_PRODUCT.material}. ${CASE_PRODUCT.details.join(" ")} ${formatMoney(CASE_PRODUCT.price)}.`,
    alternates: { canonical: casePath() },
    openGraph: {
      type: "website",
      locale: "es_CO",
      url: siteUrl(casePath()),
      title: `Mora ${CASE_PRODUCT.name}`,
      description: `${CASE_PRODUCT.promise} ${sales.promise}`,
      images: [{ url: "/cases/ice.jpg", alt: "Mora Case en hielo" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Mora ${CASE_PRODUCT.name}`,
      description: `${CASE_PRODUCT.promise} ${sales.promise}`,
      images: ["/cases/ice.jpg"],
    },
  };
}

export default async function CasePage({
  searchParams,
}: {
  searchParams: Promise<{ color?: string; desde?: string }>;
}) {
  const { color, desde } = await searchParams;
  return (
    <>
      <CaseJsonLd sales={FALLBACK_SALES} />
      <BreadcrumbJsonLd
        items={[
          { name: "Inicio", path: "/" },
          { name: `Mora ${CASE_PRODUCT.name}`, path: casePath() },
        ]}
      />
      <CaseExperience
        color={typeof color === "string" ? color : null}
        fromCheckout={desde === "pedido"}
      />
    </>
  );
}
