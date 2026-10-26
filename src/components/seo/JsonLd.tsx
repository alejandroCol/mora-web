import { BRAND } from "@/brand";
import type { SalesPresentation } from "@/commerce/sales";
import { CASE_PRODUCT, casePath } from "@/lib/cases";
import {
  PRODUCT_HOME,
  PRODUCT_LOOKS,
  productPath,
  products,
  type ModelId,
} from "@/lib/catalog";
import { siteOrigin, siteUrl } from "@/lib/site";

const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "CO",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 5,
  returnMethod: "https://schema.org/ReturnByMail",
  merchantReturnLink: siteUrl("/envios-y-garantia#retracto"),
};

const SHIPPING = {
  "@type": "OfferShippingDetails",
  shippingDestination: {
    "@type": "DefinedRegion",
    addressCountry: "CO",
  },
};

const WARRANTY = {
  "@type": "WarrantyPromise",
  durationOfWarranty: {
    "@type": "QuantitativeValue",
    value: 1,
    unitText: "mes",
  },
  warrantyScope: "Fallas de fabricación",
};

function jsonLd(data: unknown) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrgJsonLd({ sales }: { sales: SalesPresentation }) {
  const origin = siteOrigin();
  return jsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#org`,
        name: BRAND.name,
        url: origin,
        logo: `${origin}${BRAND.assets.icon512}`,
        description: sales.brandDescription,
        email: BRAND.contact.email,
        areaServed: "CO",
        sameAs: [BRAND.contact.instagram],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          email: BRAND.contact.email,
          url: BRAND.contact.whatsapp,
          areaServed: "CO",
          availableLanguage: "Spanish",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#site`,
        url: origin,
        name: BRAND.name,
        description: sales.brandDescription,
        inLanguage: "es-CO",
        publisher: { "@id": `${origin}/#org` },
      },
    ],
  });
}

function offer(sales: SalesPresentation, url: string, price: number) {
  const origin = siteOrigin();
  return {
    "@type": "Offer",
    url,
    priceCurrency: "COP",
    price,
    availability: sales.schemaAvailability,
    ...(sales.schemaAvailabilityEnds ? { availabilityEnds: sales.schemaAvailabilityEnds } : {}),
    itemCondition: "https://schema.org/NewCondition",
    shippingDetails: SHIPPING,
    hasMerchantReturnPolicy: RETURN_POLICY,
    seller: { "@id": `${origin}/#org` },
  };
}

export function ProductJsonLd({
  modelId,
  sales,
}: {
  modelId: ModelId;
  sales: SalesPresentation;
}) {
  const origin = siteOrigin();
  const model = products[modelId];
  const home = PRODUCT_HOME[modelId];
  const path = productPath(modelId);
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${siteUrl(path)}#product`,
    name: `Mora ${model.name}`,
    description: `${model.promise} ${model.material}. ${model.details.join(" ")}`,
    brand: { "@type": "Brand", name: BRAND.name },
    sku: model.id,
    material: model.material,
    image: [`${origin}${home.src}`, ...PRODUCT_LOOKS[modelId].map((item) => `${origin}${item.src}`)],
    warranty: WARRANTY,
    offers: offer(sales, siteUrl(path), model.price),
  });
}

export function CaseJsonLd({ sales }: { sales: SalesPresentation }) {
  const origin = siteOrigin();
  const path = casePath();
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${siteUrl(path)}#product`,
    name: `Mora ${CASE_PRODUCT.name}`,
    description: `${CASE_PRODUCT.promise} ${CASE_PRODUCT.material}. ${CASE_PRODUCT.details.join(" ")}`,
    brand: { "@type": "Brand", name: BRAND.name },
    sku: CASE_PRODUCT.id,
    material: CASE_PRODUCT.material,
    image: [`${origin}/cases/ice.jpg`],
    offers: offer(sales, siteUrl(path), CASE_PRODUCT.price),
  });
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; path: string }[];
}) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path === "/" ? siteOrigin() : siteUrl(item.path),
    })),
  });
}
