"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ParticleRing, sampleMesh } from "./ParticleRing";
import { RING_POSE } from "./pose";

const MODEL_PATH = "/models/mora-ring.glb";

type RingIntroProps = {
  scale: number;
};

export function RingIntro({ scale }: RingIntroProps) {
  const { scene } = useGLTF(MODEL_PATH);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const center = useMemo(() => {
    const pose = new THREE.Group();
    const probe = scene.clone(true);
    pose.rotation.set(...RING_POSE.rotation);
    pose.scale.setScalar(scale);
    pose.add(probe);
    pose.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(pose).getCenter(new THREE.Vector3());
  }, [scale, scene]);
  const motion = useRef<THREE.Group>(null);
  const appear = useRef(0);
  const targets = useMemo(() => {
    cloned.updateWorldMatrix(true, true);
    return sampleMesh(cloned);
  }, [cloned]);
  const [assembled, setAssembled] = useState(false);
  const [ready, setReady] = useState(false);
  const reveal = assembled && ready;

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
    const timer = window.setTimeout(() => setReady(true), 2200);
    return () => window.clearTimeout(timer);
  }, [cloned]);

  useFrame((state, delta) => {
    if (motion.current) {
      motion.current.rotation.y += delta * RING_POSE.spin;
      motion.current.position.y =
        Math.sin(state.clock.elapsedTime * RING_POSE.floatSpeed) * RING_POSE.float;
    }

    if (!reveal) return;
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
      <group ref={motion}>
        <group position={[-center.x, -center.y, -center.z]}>
          <group rotation={RING_POSE.rotation} scale={scale}>
            <ParticleRing
              targets={targets}
              fading={reveal}
              onAssembled={() => setAssembled(true)}
            />
            <primitive object={cloned} />
          </group>
        </group>
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
