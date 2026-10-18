import { BrandLoader } from "@/components/brand/BrandLoader";

export default function AnilloLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#f4f3f8]">
      <BrandLoader label="Abriendo el anillo" />
    </div>
  );
}
