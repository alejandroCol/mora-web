import type { Metadata } from "next";
import { Creadores } from "@/components/creadores/Creadores";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Creadores",
  description:
    "Regístrate para probar el anillo Mora en primicia.",
  alternates: { canonical: "/creadores" },
  openGraph: {
    title: "Creadores · Mora Ring",
    description: "Usa tu mora antes que nadie. Sé de los primeros.",
    url: siteUrl("/creadores"),
    images: [{ url: "/creadores/fondo.jpg", width: 1024, height: 409, alt: "Mora" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creadores · Mora Ring",
    description: "Regístrate para probar el anillo en primicia.",
    images: ["/creadores/fondo.jpg"],
  },
};

export default function CreadoresPage() {
  return (
    <>
      <link rel="preload" href="/creadores/fondo.jpg" as="image" />
      <Creadores />
    </>
  );
}
