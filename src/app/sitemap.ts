import type { MetadataRoute } from "next";
import { catalog, PRODUCT_HOME, PRODUCT_LOOKS } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: siteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
      images: catalog.map((item) => siteUrl(PRODUCT_HOME[item.id].src)),
    },
    ...catalog.map((item) => ({
      url: siteUrl(`/anillo/${item.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
      images: [PRODUCT_HOME[item.id].src, ...PRODUCT_LOOKS[item.id].map((look) => look.src)].map((src) =>
        siteUrl(src),
      ),
    })),
    {
      url: siteUrl("/case"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
      images: [siteUrl("/cases/ice.jpg")],
    },
    {
      url: siteUrl("/descargas"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: siteUrl("/soporte"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: siteUrl("/envios-y-garantia"),
      lastModified,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: siteUrl("/privacidad"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: siteUrl("/terminos"),
      lastModified,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
