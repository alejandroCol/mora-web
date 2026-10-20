import type { Metadata } from "next";
import { AnimStage } from "@/components/brand/AnimStage";

export const metadata: Metadata = {
  title: "Animación",
  robots: { index: false, follow: false },
};

export default function AnimPage() {
  return <AnimStage />;
}
