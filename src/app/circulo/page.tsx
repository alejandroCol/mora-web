import { Suspense } from "react";
import { CirculoApp } from "@/components/circulo/CirculoApp";

export default function CirculoPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center px-6">
          <p className="text-soft">Cargando…</p>
        </main>
      }
    >
      <CirculoApp />
    </Suspense>
  );
}
