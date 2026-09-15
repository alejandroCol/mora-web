import { BrandLoader } from "@/components/brand/BrandLoader";

export default function CheckoutLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-paper">
      <BrandLoader />
    </div>
  );
}
