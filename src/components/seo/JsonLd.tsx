import { BRAND } from "@/brand";
import { catalog } from "@/lib/catalog";
import { siteOrigin, siteUrl } from "@/lib/site";

const FAQ = [
  {
    q: "¿Qué es Mora?",
    a: "Mora es un smart ring de lujo silencioso. Mide pulso, oxígeno, HRV, sueño y movimiento sin una pantalla que pida atención.",
  },
  {
    q: "¿Cuál es la diferencia entre Aero y Titan?",
    a: "Aero es cerámica de alta densidad. Titan es titanio grado médico, el más ligero de la casa. Los dos cuestan lo mismo y miden lo mismo.",
  },
  {
    q: "¿Cuánto dura la batería?",
    a: "Entre cinco y siete días, según el modelo. Aero llega a siete. Titan, a seis.",
  },
  {
    q: "¿Hacen envíos en Colombia?",
    a: "Sí. El envío se cotiza al instante en el checkout, con Coordinadora, Servientrega o Deprisa.",
  },
  {
    q: "¿Cómo elijo la talla?",
    a: "Las tallas van del 6 al 13. Con el anillo llega un kit de medida si necesitas cambiar.",
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
        sameAs: [],
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
          target: siteUrl("/#reservar"),
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
          url: siteUrl("/#reservar"),
          priceCurrency: "COP",
          price: item.price,
          availability: "https://schema.org/InStock",
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
