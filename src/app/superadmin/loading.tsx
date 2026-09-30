import { BrandLoader } from "@/components/brand/BrandLoader";

export default function SuperadminLoading() {
  return (
    <div className="grid min-h-[50dvh] place-items-center">
      <BrandLoader label="Entrando" />
    </div>
  );
}
