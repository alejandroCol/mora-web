import type { MeshPhysicalMaterial } from "three";
import type { Finish } from "@/lib/catalog";

/** Una sola respuesta de material para el anillo 3D. Cerámica y negro se quedan como estaban. */
export function applyRingFinish(material: MeshPhysicalMaterial, next: Finish) {
  const gold = next.id === "gold";
  const silver = next.id === "silver";
  const glossBlack = next.id === "black" && (next.metalness > 0.3 || next.clearcoat >= 0.85);
  const matte = next.id === "black" && next.roughness > 0.55;
  const softBlack = next.id === "black" && !matte && !glossBlack;
  const ceramic = next.id === "white" || next.id === "lilac";

  material.color.set(next.color);
  material.metalness = next.metalness;
  material.roughness = next.roughness;
  material.clearcoat = next.clearcoat;
  material.clearcoatRoughness = glossBlack
    ? 0.06
    : softBlack
      ? 0.2
      : silver
        ? 0.8
        : gold
          ? 0.1
          : ceramic
            ? 0.35
            : 0.9;
  material.envMapIntensity = next.envMapIntensity;
  material.emissive.set(next.emissive);
  material.emissiveIntensity = next.emissiveIntensity;
  material.sheen = gold || silver || matte || glossBlack || softBlack ? 0 : 0.16;
  material.sheenColor.set(next.id === "lilac" ? "#EFC2CD" : "#f4f8ff");
  material.specularIntensity = gold
    ? 1
    : silver
      ? 0.5
      : glossBlack
        ? 1
        : softBlack
          ? 0.68
          : matte
            ? 0.12
            : 0.45;
  material.anisotropy = 0;
  material.vertexColors = false;
}

export type FinishLighting = {
  ambient: number;
  key: number;
  keyColor: string;
  fill: number;
  under: number;
  environment: number;
};

const BASE_LIGHTING: FinishLighting = {
  ambient: 0.62,
  key: 1.2,
  keyColor: "#fff6ea",
  fill: 0.42,
  under: 0.28,
  environment: 0.92,
};

/** Luces del visor 3D por acabado; los acabados nuevos heredan la base. */
export function finishLighting(finish: Finish): FinishLighting {
  if (finish.id === "silver") {
    return { ambient: 0.7, key: 0.72, keyColor: "#f4f6f8", fill: 0.28, under: 0.1, environment: 0.58 };
  }
  if (finish.id === "gold") {
    return { ambient: 0.58, key: 1.15, keyColor: "#fff5e6", fill: 0.34, under: 0.34, environment: 1.34 };
  }
  if (finish.id === "black" && finish.clearcoat > 0.4) {
    return { ambient: 0.38, key: 1.55, keyColor: BASE_LIGHTING.keyColor, fill: 0.55, under: 0.22, environment: 1.35 };
  }
  if (finish.id === "black" && finish.roughness > 0.55) {
    return { ...BASE_LIGHTING, ambient: 0.5, key: 1.3, fill: 0.48, environment: 0.85 };
  }
  return BASE_LIGHTING;
}
