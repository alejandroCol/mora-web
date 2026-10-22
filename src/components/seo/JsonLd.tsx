import { BRAND } from "@/brand";
import { storeFaq, type SalesPresentation } from "@/commerce/sales";
import { catalog } from "@/lib/catalog";
import { siteOrigin, siteUrl } from "@/lib/site";

export function JsonLd({ sales }: { sales: SalesPresentation }) {
  const origin = siteOrigin();
  const faq = storeFaq(sales);
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#org`,
        name: BRAND.name,
        url: origin,
        logo: `${origin}${BRAND.assets.icon512}`,
        description: sales.brandDescription,
        sameAs: [BRAND.contact.instagram],
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#site`,
        url: origin,
        name: BRAND.name,
        description: sales.brandDescription,
        inLanguage: "es-CO",
        publisher: { "@id": `${origin}/#org` },
        potentialAction: {
          "@type": sales.schemaAction,
          target: siteUrl("/#coleccion"),
          name: "Elegir un anillo Mora",
        },
      },
      ...catalog.map((item) => ({
        "@type": "Product",
        "@id": `${origin}/#${item.id}`,
        name: `Mora ${item.name}`,
        description: `${item.promise} ${item.material}. ${item.details.join(" ")}`,
        brand: { "@type": "Brand", name: BRAND.name },
        sku: item.id,
        material: item.material,
        image: [`${origin}${BRAND.assets.mark}`],
        offers: {
          "@type": "Offer",
          url: siteUrl(`/anillo/${item.slug}`),
          priceCurrency: "COP",
          price: item.price,
          availability: sales.schemaAvailability,
          ...(sales.schemaAvailabilityEnds
            ? { availabilityEnds: sales.schemaAvailabilityEnds }
            : {}),
          itemCondition: "https://schema.org/NewCondition",
        },
      })),
      {
        "@type": "FAQPage",
        "@id": `${origin}/#faq`,
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
