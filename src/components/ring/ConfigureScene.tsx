"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, ContactShadows, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { finishes, type FinishId } from "@/lib/catalog";
import { ParticleRing, sampleMesh } from "./ParticleRing";
import { RING_POSE } from "./pose";

const MODEL_PATH = "/models/mora-superficie.glb";

useGLTF.preload(MODEL_PATH);

function radialExtent(mesh: THREE.Mesh) {
  const pos = mesh.geometry.attributes.position;
  let max = 0;
  for (let i = 0; i < pos.count; i += 1) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (r > max) max = r;
  }
  return max;
}

function stampOuterMask(geometry: THREE.BufferGeometry) {
  const pos = geometry.attributes.position;
  let rMax = 0;
  for (let i = 0; i < pos.count; i += 1) {
    rMax = Math.max(rMax, Math.hypot(pos.getX(i), pos.getZ(i)));
  }
  const inner = rMax * 0.74;
  const outer = rMax * 0.88;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    const t = THREE.MathUtils.smoothstep(inner, outer, r);
    colors[i * 3] = t;
    colors[i * 3 + 1] = t;
    colors[i * 3 + 2] = t;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function collectSurfaceMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry.attributes.position) {
      meshes.push(child);
    }
  });

  const named = meshes.filter((mesh) => {
    const name = `${mesh.name} ${mesh.parent?.name ?? ""}`.toLowerCase();
    return (
      name.includes("superficie") ||
      name.includes("surface") ||
      name.includes("shell")
    );
  });
  if (named.length) return named;

  const shells = meshes
    .filter((mesh) => mesh.geometry.attributes.position.count > 8000)
    .sort((a, b) => radialExtent(b) - radialExtent(a));
  return shells.slice(0, 1);
}

type ConfigureSceneProps = {
  finishId: FinishId;
  scale?: number;
};

export function ConfigureScene({ finishId, scale = 0.9 }: ConfigureSceneProps) {
  const { scene } = useGLTF(MODEL_PATH);
  const group = useRef<THREE.Group>(null);
  const surface = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const lastFinish = useRef(finishId);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const targets = useMemo(() => {
    cloned.updateWorldMatrix(true, true);
    return sampleMesh(cloned);
  }, [cloned]);
  const finish = finishes[finishId];
  const target = useMemo(
    () => new THREE.Color(finish.color),
    [finish.color],
  );
  const [replay, setReplay] = useState(0);
  const [bursting, setBursting] = useState(false);
  const [fading, setFading] = useState(false);

  useLayoutEffect(() => {
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    const shells = collectSurfaceMeshes(cloned);
    if (surface.current.length === 0) {
      surface.current = shells.map((mesh) => {
        stampOuterMask(mesh.geometry);
        const material = new THREE.MeshPhysicalMaterial({
          color: finish.color,
          metalness: finish.metalness,
          roughness: finish.roughness,
          clearcoat: finish.clearcoat,
          clearcoatRoughness: 0.18,
          envMapIntensity: 1.4,
          opacity: 1,
          vertexColors: true,
          sheen: finish.metalness < 0.5 ? 0.16 : 0,
          sheenColor: new THREE.Color("#e8e4f2"),
        });
        mesh.material = material;
        return material;
      });
    }
  }, [cloned, finish]);

  useEffect(() => {
    if (lastFinish.current === finishId) return;
    lastFinish.current = finishId;
    setFading(false);
    setBursting(true);
    setReplay((value) => value + 1);
  }, [finishId]);

  useLayoutEffect(() => {
    const cover = bursting && !fading ? 0.14 : 1;
    /* eslint-disable react-hooks/immutability -- Three.js materials */
    for (const material of surface.current) {
      material.opacity = cover;
      material.transparent = cover < 1;
      material.metalness = finish.metalness;
      material.roughness = finish.roughness;
      material.clearcoat = finish.clearcoat;
    }
    /* eslint-enable react-hooks/immutability */
  }, [bursting, fading, finish]);

  useFrame((state, delta) => {
    for (const material of surface.current) {
      material.color.lerp(target, bursting && !fading ? 0.02 : 0.12);
    }

    if (!group.current) return;
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
          <group rotation={RING_POSE.rotation} scale={scale}>
            {bursting ? (
              <ParticleRing
                targets={targets}
                replay={replay}
                tint={finish.color}
                fading={fading}
                onAssembled={() => {
                  for (const material of surface.current) {
                    material.color.set(finish.color);
                  }
                  setFading(true);
                  window.setTimeout(() => setBursting(false), 700);
                }}
              />
            ) : null}
            <primitive object={cloned} />
          </group>
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
