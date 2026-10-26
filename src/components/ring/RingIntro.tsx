"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, useEnvironment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ParticleRing } from "./ParticleRing";
import { RING_POSE } from "./pose";
import { preloadRingParticles, type RingParticleCloud } from "./ringParticleCloud";

const MODEL_PATH = "/models/mora-ring.glb";
const STUDIO_INTENSITY = 0.68;

if (typeof window !== "undefined") {
  useEnvironment.preload({ preset: "studio" });
}

function mapReady(material: THREE.Material) {
  const map = (material as THREE.Material & { map?: THREE.Texture | null }).map;
  if (!map) return true;
  const image = map.image as { width?: number } | undefined;
  return Boolean(image && (image.width ?? 0) > 0);
}

function hideRing(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const raw = child.material;
    const list = Array.isArray(raw) ? raw : [raw];
    const cloned = list.filter(Boolean).map((material) => material.clone());
    child.material = Array.isArray(raw) ? cloned : cloned[0];
    for (const material of cloned) {
      material.transparent = true;
      material.opacity = 0;
      material.depthWrite = false;
      if ("envMapIntensity" in material) material.envMapIntensity = 1.05;
      if ("roughness" in material && typeof material.roughness === "number") {
        material.roughness = Math.min(material.roughness, 0.38);
      }
    }
  });
}

function StudioEnvironment({ onReady }: { onReady: () => void }) {
  const texture = useEnvironment({ preset: "studio" });
  const scene = useThree((state) => state.scene);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useLayoutEffect(() => {
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = texture;
    scene.environmentIntensity = STUDIO_INTENSITY;
    onReadyRef.current();
    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
    };
  }, [scene, texture]);

  return null;
}

type RingIntroProps = {
  scale: number;
  onProgress?: (ease: number) => void;
};

function SolidRing({
  visible,
  environmentReady,
  onReady,
}: {
  visible: boolean;
  environmentReady: boolean;
  onReady: () => void;
}) {
  const { scene } = useGLTF(MODEL_PATH);
  const cloned = useMemo(() => {
    const next = scene.clone(true);
    next.visible = false;
    hideRing(next);
    return next;
  }, [scene]);
  const appear = useRef(0);
  const primed = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useFrame((_, delta) => {
    if (!primed.current && environmentReady) {
      let texturesReady = true;
      cloned.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !texturesReady) return;
        const raw = child.material;
        const list = Array.isArray(raw) ? raw : [raw];
        if (list.some((material) => material && !mapReady(material))) texturesReady = false;
      });
      if (texturesReady) {
        primed.current = true;
        onReadyRef.current();
      }
    }

    cloned.visible = visible;
    if (!visible || appear.current >= 1) return;
    appear.current = Math.min(1, appear.current + delta * 1.25);
    const shown = appear.current;
    cloned.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const raw = child.material;
      const list = Array.isArray(raw) ? raw : [raw];
      for (const material of list) {
        if (!material) continue;
        material.opacity = shown;
        material.transparent = shown < 1;
        material.depthWrite = shown > 0.92;
      }
    });
  });

  return <primitive object={cloned} />;
}

export function RingIntro({ scale, onProgress }: RingIntroProps) {
  const [cloud, setCloud] = useState<RingParticleCloud | null>(null);
  const [assembled, setAssembled] = useState(false);
  const [meshReady, setMeshReady] = useState(false);
  const [envReady, setEnvReady] = useState(false);
  const motion = useRef<THREE.Group>(null);
  // El sólido espera luz de estudio y textura. Si no, entra oscuro y tapa las partículas.
  const reveal = assembled && meshReady && envReady;

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
                <SolidRing
                  visible={reveal}
                  environmentReady={envReady}
                  onReady={() => setMeshReady(true)}
                />
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
        <StudioEnvironment onReady={() => setEnvReady(true)} />
      </Suspense>
    </>
  );
}
