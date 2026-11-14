import { BRAND } from "@/brand";
import { storeFaq, type SalesPresentation } from "@/commerce/sales";
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
  returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
  merchantReturnLink: siteUrl("/envios-y-garantia#retracto"),
};

const DELIVERY_TIME = {
  "@type": "ShippingDeliveryTime",
  handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
  transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 10, unitCode: "DAY" },
};

/** Gratis si el pedido trae un anillo; el Case solo se cotiza en el checkout y no lleva tarifa fija. */
function shippingDetails(freeShipping: boolean) {
  return {
    "@type": "OfferShippingDetails",
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "CO",
    },
    ...(freeShipping
      ? { shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "COP" } }
      : {}),
    deliveryTime: DELIVERY_TIME,
  };
}

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
        name: BRAND.siteName,
        alternateName: BRAND.name,
        url: origin,
        logo: {
          "@type": "ImageObject",
          url: `${origin}${BRAND.assets.icon512}`,
          width: 512,
          height: 512,
        },
        image: `${origin}${BRAND.assets.icon512}`,
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
        url: `${origin}/`,
        name: BRAND.siteName,
        alternateName: [BRAND.name, "moraring.com"],
        description: sales.brandDescription,
        inLanguage: "es-CO",
        publisher: { "@id": `${origin}/#org` },
      },
    ],
  });
}

function offer(sales: SalesPresentation, url: string, price: number, freeShipping: boolean) {
  const origin = siteOrigin();
  return {
    "@type": "Offer",
    url,
    priceCurrency: "COP",
    price,
    availability: sales.schemaAvailability,
    ...(sales.schemaAvailabilityEnds ? { availabilityEnds: sales.schemaAvailabilityEnds } : {}),
    itemCondition: "https://schema.org/NewCondition",
    shippingDetails: shippingDetails(freeShipping),
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
    brand: { "@type": "Brand", name: BRAND.siteName },
    sku: model.id,
    material: model.material,
    image: [`${origin}${home.src}`, ...PRODUCT_LOOKS[modelId].map((item) => `${origin}${item.src}`)],
    warranty: WARRANTY,
    offers: offer(sales, siteUrl(path), model.price, true),
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
    brand: { "@type": "Brand", name: BRAND.siteName },
    sku: CASE_PRODUCT.id,
    material: CASE_PRODUCT.material,
    image: [`${origin}/cases/ice.jpg`],
    offers: offer(sales, siteUrl(path), CASE_PRODUCT.price, false),
  });
}

export function FaqJsonLd({ sales }: { sales: SalesPresentation }) {
  return jsonLd({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: storeFaq(sales).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
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
