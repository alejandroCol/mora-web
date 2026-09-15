import { BrandLoader } from "@/components/brand/BrandLoader";

export default function SuperadminLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#0e0d14]">
      <BrandLoader label="Abriendo el atelier" />
    </div>
  );
}
