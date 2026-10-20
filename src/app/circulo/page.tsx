import { Suspense } from "react";
import { BrandLoader } from "@/components/brand/BrandLoader";
import { CirculoApp } from "@/components/circulo/CirculoApp";

export default function CirculoPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
          <BrandLoader />
        </main>
      }
    >
      <CirculoApp />
    </Suspense>
  );
}
