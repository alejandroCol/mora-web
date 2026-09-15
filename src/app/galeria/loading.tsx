import { BrandLoader } from "@/components/brand/BrandLoader";

export default function GaleriaLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f4f3f8]">
      <BrandLoader label="Abriendo la galería" />
    </div>
  );
}
