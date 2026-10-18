import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/superadmin", "/acceso", "/circulo", "/api/", "/pago", "/checkout", "/pedido", "/talla"],
      },
    ],
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}
