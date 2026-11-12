import type { MetadataRoute } from "next";
import { catalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: siteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...catalog.map((item) => ({
      url: siteUrl(`/anillo/${item.slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    {
      url: siteUrl("/case"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
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
