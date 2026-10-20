"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ParticleRing } from "./ParticleRing";
import { RING_POSE } from "./pose";
import { preloadRingParticles, type RingParticleCloud } from "./ringParticleCloud";

const MODEL_PATH = "/models/mora-ring.glb";

type RingIntroProps = {
  scale: number;
  onProgress?: (ease: number) => void;
};

function SolidRing({
  visible,
  onReady,
}: {
  visible: boolean;
  onReady: () => void;
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const appear = useRef(0);

  useLayoutEffect(() => {
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      const raw = child.material;
      const list = Array.isArray(raw) ? raw : [raw];
      for (const material of list) {
        if (!material) continue;
        material.transparent = true;
        material.opacity = 0;
        if ("envMapIntensity" in material) material.envMapIntensity = 1.05;
        if ("roughness" in material && typeof material.roughness === "number") {
          material.roughness = Math.min(material.roughness, 0.38);
        }
      }
    });
    onReady();
  }, [cloned, onReady]);

  useFrame((_, delta) => {
    if (!visible) return;
    appear.current = Math.min(1, appear.current + delta * 1.25);
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const raw = child.material;
      const list = Array.isArray(raw) ? raw : [raw];
      for (const material of list) {
        if (!material) continue;
        material.transparent = appear.current < 1;
        material.opacity = appear.current;
      }
    });
  });

  return <primitive object={cloned} />;
}

export function RingIntro({ scale, onProgress }: RingIntroProps) {
  const [cloud, setCloud] = useState<RingParticleCloud | null>(null);
  const [assembled, setAssembled] = useState(false);
  const [meshReady, setMeshReady] = useState(false);
  const motion = useRef<THREE.Group>(null);
  const reveal = assembled && meshReady;

  useEffect(() => {
    void preloadRingParticles().then(setCloud);
  }, []);

  useEffect(() => {
    if (!cloud) return;
    useGLTF.preload(MODEL_PATH);
  }, [cloud]);

  useFrame((state, delta) => {
    if (!motion.current) return;
    motion.current.rotation.y += delta * RING_POSE.spin;
    motion.current.position.y =
      Math.sin(state.clock.elapsedTime * RING_POSE.floatSpeed) * RING_POSE.float;
  });

  const center = cloud
    ? ([
        cloud.center[0] * scale,
        cloud.center[1] * scale,
        cloud.center[2] * scale,
      ] as const)
    : ([0, 0, 0] as const);

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
      {cloud ? (
        <group ref={motion}>
          <group position={[-center[0], -center[1], -center[2]]}>
            <group rotation={RING_POSE.rotation} scale={scale}>
              <ParticleRing
                targets={cloud.targets}
                fading={reveal}
                onProgress={onProgress}
                onAssembled={() => setAssembled(true)}
              />
              <Suspense fallback={null}>
                <SolidRing visible={reveal} onReady={() => setMeshReady(true)} />
              </Suspense>
            </group>
          </group>
        </group>
      ) : null}
      <ContactShadows
        position={[0, -0.52 * (scale / 1.08), 0]}
        opacity={0.14}
        scale={4.2}
        blur={3.4}
        far={2.2}
        color="#1c1830"
      />
      <Suspense fallback={null}>
        <Environment preset="studio" environmentIntensity={0.68} />
      </Suspense>
    </>
  );
}
