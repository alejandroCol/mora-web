"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Center, ContactShadows, Environment, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { resolveFinish, type Finish, type FinishId, type ModelId } from "@/lib/catalog";
import { applyRingFinish, finishLighting } from "./finishMaterial";
import { bandFrames, idealBandNormals } from "./polishedNormals";
import { ParticleRing, sampleMesh } from "./ParticleRing";
import { DETAIL_POSE, RING_POSE } from "./pose";

const MODEL_PATH = "/models/mora-superficie.glb";

useGLTF.preload(MODEL_PATH);

function outwardShare(mesh: THREE.Mesh) {
  const pos = mesh.geometry.attributes.position;
  const nrm = mesh.geometry.attributes.normal;
  if (!nrm) return 0;
  let outward = 0;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const radius = Math.hypot(x, z);
    const radial =
      radius > 1e-6 ? (nrm.getX(i) * x + nrm.getZ(i) * z) / radius : 0;
    if (radial > 0.12 || Math.abs(nrm.getY(i)) > 0.55) outward += 1;
  }
  return outward / pos.count;
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

  return meshes.filter(
    (mesh) =>
      mesh.geometry.attributes.position.count > 8000 &&
      outwardShare(mesh) > 0.85,
  );
}

type ShellNormals = {
  geometry: THREE.BufferGeometry;
  original: THREE.BufferAttribute;
  polished: THREE.BufferAttribute;
};

function shellNormals(root: THREE.Object3D, meshes: THREE.Mesh[]): ShellNormals[] {
  const frames = bandFrames(root, meshes);
  return meshes.map((mesh, index) => ({
    geometry: mesh.geometry,
    original: mesh.geometry.attributes.normal as THREE.BufferAttribute,
    polished: new THREE.BufferAttribute(idealBandNormals(mesh.geometry, frames[index]), 3),
  }));
}

function applyFinish(
  materials: THREE.MeshPhysicalMaterial[],
  shells: ShellNormals[],
  next: Finish,
) {
  for (const material of materials) applyRingFinish(material, next);
  for (const shell of shells) {
    const wanted = next.polished ? shell.polished : shell.original;
    if (shell.geometry.attributes.normal !== wanted) shell.geometry.setAttribute("normal", wanted);
  }
}

type ConfigureSceneProps = {
  finishId: FinishId;
  modelId?: ModelId;
  scale?: number;
  floatOnly?: boolean;
};

export function ConfigureScene({
  finishId,
  modelId = "aero",
  scale = 0.9,
  floatOnly = false,
}: ConfigureSceneProps) {
  const pose = floatOnly ? DETAIL_POSE : RING_POSE;
  const { scene } = useGLTF(MODEL_PATH);
  const group = useRef<THREE.Group>(null);
  const surface = useRef<THREE.MeshPhysicalMaterial[]>([]);
  const normals = useRef<ShellNormals[]>([]);
  const lastFinish = useRef(finishId);
  const burstTimer = useRef<number>(0);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const targets = useMemo(() => {
    cloned.updateWorldMatrix(true, true);
    return sampleMesh(cloned);
  }, [cloned]);
  const [appliedId, setAppliedId] = useState(finishId);
  const applied = resolveFinish(modelId, appliedId);
  const pending = resolveFinish(modelId, finishId);
  const light = finishLighting(pending);
  const pendingRef = useRef(pending);
  const finishIdRef = useRef(finishId);
  const revealed = useRef(false);
  pendingRef.current = pending;
  finishIdRef.current = finishId;
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
    surface.current = shells.map((mesh) => {
      // Copia propia: la geometría del clon es la misma que guarda la caché de useGLTF.
      mesh.geometry = mesh.geometry.clone();
      mesh.geometry.deleteAttribute("color");
      const material = new THREE.MeshPhysicalMaterial({ opacity: 1 });
      mesh.material = material;
      return material;
    });
    normals.current = shellNormals(cloned, shells);
    applyFinish(surface.current, normals.current, applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cloned scene only
  }, [cloned]);

  useEffect(() => {
    if (lastFinish.current === finishId) return;
    lastFinish.current = finishId;
    window.clearTimeout(burstTimer.current);
    revealed.current = false;
    setFading(false);
    setBursting(true);
    setReplay((value) => value + 1);
  }, [finishId]);

  useLayoutEffect(() => {
    if (!bursting || fading) return;
    /* eslint-disable react-hooks/immutability -- Three.js materials */
    applyFinish(surface.current, normals.current, applied);
    for (const material of surface.current) {
      material.opacity = 0.08;
      material.transparent = true;
    }
    /* eslint-enable react-hooks/immutability */
  }, [applied, bursting, fading, replay]);

  const revealPending = (ease: number) => {
    const t = THREE.MathUtils.smoothstep(0.62, 0.88, ease);
    if (t <= 0 || revealed.current) return;
    applyFinish(surface.current, normals.current, pendingRef.current);
    for (const material of surface.current) {
      material.opacity = 0.08 + t * 0.92;
      material.transparent = t < 1;
    }
  };

  useFrame((state, delta) => {
    if (!group.current) return;
    if (pose.spin) group.current.rotation.y += delta * pose.spin;
    group.current.position.y =
      Math.sin(state.clock.elapsedTime * pose.floatSpeed) * pose.float;
  });

  return (
    <>
      <ambientLight intensity={light.ambient} />
      <directionalLight position={[2.6, 3.4, 2.2]} intensity={light.key} color={light.keyColor} />
      <directionalLight position={[-2.4, 1.1, -1.6]} intensity={light.fill} color="#dce6f6" />
      <directionalLight position={[0.2, -1.6, 1.4]} intensity={light.under} color="#f0d7a4" />
      <group ref={group}>
        <Center>
          <group rotation={pose.rotation} scale={scale}>
            {bursting ? (
              <ParticleRing
                targets={targets}
                replay={replay}
                tint={pending.color}
                fading={fading}
                onProgress={revealPending}
                onAssembled={() => {
                  revealed.current = true;
                  applyFinish(surface.current, normals.current, pendingRef.current);
                  for (const material of surface.current) {
                    material.opacity = 1;
                    material.transparent = false;
                  }
                  setAppliedId(finishIdRef.current);
                  setFading(true);
                  window.clearTimeout(burstTimer.current);
                  burstTimer.current = window.setTimeout(
                    () => setBursting(false),
                    420,
                  );
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
      <Environment preset="studio" environmentIntensity={light.environment} />
    </>
  );
}
