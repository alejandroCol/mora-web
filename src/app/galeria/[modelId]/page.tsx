import { notFound } from "next/navigation";
import { GalleryExperience } from "@/components/gallery/GalleryExperience";
import { products, type ModelId } from "@/lib/catalog";

export function generateStaticParams() {
  return (Object.keys(products) as ModelId[]).map((modelId) => ({ modelId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const model = products[modelId as ModelId];
  if (!model) return { title: "Galería" };
  return {
    title: `${model.name} · ${model.line}`,
    description: `${model.promise} ${model.material}. ${model.details.join(" ")} Desde ${model.price.toLocaleString("es-CO")} COP.`,
    alternates: { canonical: `/galeria/${model.id}` },
    openGraph: {
      title: `Mora ${model.name}`,
      description: model.promise,
    },
  };
}

export default async function GaleriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<{ entrada?: string }>;
}) {
  const { modelId } = await params;
  const { entrada } = await searchParams;
  if (!(modelId in products)) notFound();
  return (
    <GalleryExperience modelId={modelId as ModelId} entrada={entrada === "1"} />
  );
}
