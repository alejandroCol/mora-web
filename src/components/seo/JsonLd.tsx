import { BRAND } from "@/brand";
import { catalog } from "@/lib/catalog";
import { siteOrigin, siteUrl } from "@/lib/site";

const FAQ = [
  {
    q: "¿Pro o Ultra?",
    a: "Pro es cerámica. Ultra es titanio, el más ligero. Los dos cuestan igual y miden lo mismo.",
  },
  {
    q: "¿Cuánto dura la batería?",
    a: "Cinco a siete días. Pro llega a siete. Ultra, a seis.",
  },
  {
    q: "¿Cómo elijo la talla?",
    a: "Pides el medidor —llega primero— o te mides en casa con la guía. El precio no cambia.",
  },
  {
    q: "¿Cuándo llega?",
    a: "Preventa. El anillo se entrega el 20 de noviembre.",
  },
];

export function JsonLd() {
  const origin = siteOrigin();
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#org`,
        name: BRAND.name,
        url: origin,
        logo: `${origin}${BRAND.assets.icon512}`,
        description: BRAND.description,
        sameAs: [BRAND.contact.instagram],
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#site`,
        url: origin,
        name: BRAND.name,
        description: BRAND.description,
        inLanguage: "es-CO",
        publisher: { "@id": `${origin}/#org` },
        potentialAction: {
          "@type": "ReserveAction",
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
          availability: "https://schema.org/PreOrder",
          availabilityEnds: "2026-11-20",
          itemCondition: "https://schema.org/NewCondition",
        },
      })),
      {
        "@type": "FAQPage",
        "@id": `${origin}/#faq`,
        mainEntity: FAQ.map((item) => ({
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

export { FAQ };
