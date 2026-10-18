import { PaymentReturn } from "@/components/payments/PaymentReturn";

export default function PagoPage() {
  return (
    <div className="hero-wash min-h-dvh px-6 pt-[calc(5.5rem+env(safe-area-inset-top))] pb-20">
      <PaymentReturn />
    </div>
  );
}
