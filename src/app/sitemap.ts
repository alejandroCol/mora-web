import type { MetadataRoute } from "next";
import { catalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...catalog.map((item) => ({
      url: siteUrl(`/anillo/${item.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    {
      url: siteUrl("/case"),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: siteUrl("/descargas"),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: siteUrl("/envios-y-garantia"),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: siteUrl("/privacidad"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: siteUrl("/terminos"),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];
}
