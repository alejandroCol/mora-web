import type { MeshPhysicalMaterial } from "three";
import type { Finish } from "@/lib/catalog";

/** Una sola respuesta de material para el anillo 3D. Cerámica y negro se quedan como estaban. */
export function applyRingFinish(material: MeshPhysicalMaterial, next: Finish) {
  const gold = next.id === "gold";
  const silver = next.id === "silver";
  const matte = next.id === "black";
  const ceramic = next.id === "white" || next.id === "lilac";

  material.color.set(next.color);
  material.metalness = next.metalness;
  material.roughness = next.roughness;
  material.clearcoat = next.clearcoat;
  material.clearcoatRoughness = silver ? 0.8 : gold ? 0.1 : ceramic ? 0.35 : 0.9;
  material.envMapIntensity = next.envMapIntensity;
  material.emissive.set(next.emissive);
  material.emissiveIntensity = next.emissiveIntensity;
  material.sheen = gold || silver || matte ? 0 : 0.16;
  material.sheenColor.set(next.id === "lilac" ? "#E4D7F6" : "#f4f8ff");
  material.specularIntensity = gold ? 1 : silver ? 0.5 : matte ? 0.12 : 0.45;
  material.anisotropy = 0;
  material.vertexColors = false;
}
