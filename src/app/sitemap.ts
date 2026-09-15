import type { MetadataRoute } from "next";
import { catalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: siteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: siteUrl("/checkout"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: siteUrl("/pedido"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    ...catalog.map((item) => ({
      url: siteUrl(`/galeria/${item.id}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
