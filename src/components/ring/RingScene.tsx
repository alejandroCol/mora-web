"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, ContactShadows, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { finishes, type FinishId } from "@/lib/catalog";
import { RING_POSE } from "./pose";

const MODEL_PATH = "/models/mora-ring.glb";

useGLTF.preload(MODEL_PATH);

type RingSceneProps = {
  finishId?: FinishId;
  original?: boolean;
  paused?: boolean;
  scale?: number;
};

export function RingScene({
  finishId = "white",
  original = false,
  paused = false,
  scale = 1.08,
}: RingSceneProps) {
  const { scene } = useGLTF(MODEL_PATH);
  const group = useRef<THREE.Group>(null);
  const materials = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const finish = finishes[finishId];
  const target = useMemo(
    () => new THREE.Color(finish.color),
    [finish.color],
  );

  useLayoutEffect(() => {
    if (original) {
      cloned.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const raw = child.material;
        const list = Array.isArray(raw) ? raw : [raw];
        for (const material of list) {
          if (!material) continue;
          if ("envMapIntensity" in material) {
            material.envMapIntensity = 1.05;
          }
          if ("roughness" in material && typeof material.roughness === "number") {
            material.roughness = Math.min(material.roughness, 0.38);
          }
        }
      });
      return;
    }

    if (materials.current.length === 0) {
      const next: THREE.MeshPhysicalMaterial[] = [];
      cloned.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;
        const material = new THREE.MeshPhysicalMaterial({
          color: finish.color,
          metalness: finish.metalness,
          roughness: finish.roughness,
          clearcoat: finish.clearcoat,
          clearcoatRoughness: 0.18,
          envMapIntensity: 1.35,
          sheen: finish.metalness < 0.5 ? 0.18 : 0,
          sheenColor: new THREE.Color("#e8e4f2"),
        });
        child.material = material;
        next.push(material);
      });
      materials.current = next;
      return;
    }

    for (const material of materials.current) {
      material.metalness = finish.metalness;
      material.roughness = finish.roughness;
      material.clearcoat = finish.clearcoat;
      material.sheen = finish.metalness < 0.5 ? 0.18 : 0;
    }
  }, [cloned, finish, original]);

  useFrame((state, delta) => {
    if (!original) {
      for (const material of materials.current) {
        material.color.lerp(target, 0.08);
      }
    }

    if (!group.current || paused) return;
    group.current.rotation.y += delta * RING_POSE.spin;
    group.current.position.y =
      Math.sin(state.clock.elapsedTime * RING_POSE.floatSpeed) * RING_POSE.float;
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[2.6, 3.4, 2.2]}
        intensity={1.05}
        color="#fff8f2"
      />
      <directionalLight
        position={[-2.4, 1.1, -1.6]}
        intensity={0.48}
        color="#dce6f6"
      />
      <group ref={group}>
        <Center>
          <primitive
            object={cloned}
            scale={scale}
            rotation={RING_POSE.rotation}
          />
        </Center>
      </group>
      <ContactShadows
        position={[0, -0.52 * (scale / 1.08), 0]}
        opacity={0.14}
        scale={4.2}
        blur={3.4}
        far={2.2}
        color="#1c1830"
      />
      <Environment preset="studio" environmentIntensity={0.68} />
    </>
  );
}
