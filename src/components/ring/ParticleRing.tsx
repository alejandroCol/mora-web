"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export const PARTICLE_COUNT = 36000;

function paintColors(colors: Float32Array, tint?: string) {
  const base = new THREE.Color(tint ?? "#f3eee6");
  const highlight = base.clone().lerp(new THREE.Color("#ffffff"), 0.62);
  const shade = base.clone().lerp(new THREE.Color("#ffffff"), 0.18);
  const mix = new THREE.Color();

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const tone = Math.random();
    if (tone < 0.55) mix.copy(shade).lerp(base, tone / 0.55);
    else mix.copy(base).lerp(highlight, (tone - 0.55) / 0.45);
    colors[i * 3] = mix.r;
    colors[i * 3 + 1] = mix.g;
    colors[i * 3 + 2] = mix.b;
  }
}

function scatterFrom(target: Float32Array) {
  const start = new Float32Array(target.length);
  for (let i = 0; i < target.length; i += 3) {
    const tx = target[i];
    const ty = target[i + 1];
    const tz = target[i + 2];
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = 0.04 + Math.random() * 0.16;
    const expand = 1.02 + Math.random() * 0.12;
    start[i] = tx * expand + radius * Math.sin(phi) * Math.cos(theta);
    start[i + 1] = ty * expand + radius * Math.sin(phi) * Math.sin(theta);
    start[i + 2] = tz * expand + radius * Math.cos(phi);
  }
  return start;
}

type ParticleRingProps = {
  targets: Float32Array;
  fading?: boolean;
  replay?: number;
  tint?: string;
  onProgress?: (ease: number) => void;
  onAssembled?: () => void;
};

export function ParticleRing({
  targets,
  fading = false,
  replay = 0,
  tint,
  onProgress,
  onAssembled,
}: ParticleRingProps) {
  const material = useRef<THREE.PointsMaterial>(null);
  const assembled = useRef(false);
  const progress = useRef(0);
  const fade = useRef(1);
  const onProgressRef = useRef(onProgress);
  const onAssembledRef = useRef(onAssembled);
  onProgressRef.current = onProgress;
  onAssembledRef.current = onAssembled;

  const { positions, start, colors } = useMemo(() => {
    void replay;
    const start = scatterFrom(targets);
    const positions = new Float32Array(start);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    paintColors(colors, tint);
    return { positions, start, colors };
  }, [targets, replay, tint]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [colors, positions]);

  useLayoutEffect(() => {
    progress.current = 0;
    assembled.current = false;
    fade.current = 1;
  }, [replay]);

  useFrame((_, delta) => {
    progress.current = Math.min(1, progress.current + delta * 0.62);
    const ease = 1 - (1 - progress.current) ** 3;
    onProgressRef.current?.(ease);

    if (!assembled.current && ease >= 0.88) {
      assembled.current = true;
      onAssembledRef.current?.();
    }

    if (progress.current < 1) {
      const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
      const array = attribute.array as Float32Array;

      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const i3 = i * 3;
        array[i3] = start[i3] + (targets[i3] - start[i3]) * ease;
        array[i3 + 1] = start[i3 + 1] + (targets[i3 + 1] - start[i3 + 1]) * ease;
        array[i3 + 2] = start[i3 + 2] + (targets[i3 + 2] - start[i3 + 2]) * ease;
      }
      attribute.needsUpdate = true;
    }

    fade.current = THREE.MathUtils.damp(fade.current, fading ? 0 : 1, fading ? 14 : 8, delta);
    if (material.current) {
      material.current.opacity = fade.current * 0.92;
      material.current.size = 0.0075 + (1 - ease) * 0.008;
    }
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={material}
        vertexColors
        size={0.008}
        sizeAttenuation
        transparent
        depthWrite={false}
        opacity={0.9}
      />
    </points>
  );
}

export function sampleMesh(root: THREE.Object3D, count = PARTICLE_COUNT) {
  const meshes: THREE.Mesh[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry.attributes.position) {
      meshes.push(child);
    }
  });

  const totals = meshes.map((mesh) => mesh.geometry.attributes.position.count);
  const vertexCount = totals.reduce((sum, value) => sum + value, 0);
  const target = new Float32Array(count * 3);
  const point = new THREE.Vector3();

  if (vertexCount === 0) return target;

  for (let i = 0; i < count; i += 1) {
    let pick = Math.floor(Math.random() * vertexCount);
    let mesh = meshes[0];
    for (let m = 0; m < meshes.length; m += 1) {
      if (pick < totals[m]) {
        mesh = meshes[m];
        break;
      }
      pick -= totals[m];
    }
    const index = Math.floor(Math.random() * mesh.geometry.attributes.position.count);
    point.fromBufferAttribute(mesh.geometry.attributes.position, index);
    mesh.localToWorld(point);
    root.worldToLocal(point);
    target[i * 3] = point.x;
    target[i * 3 + 1] = point.y;
    target[i * 3 + 2] = point.z;
  }

  return target;
}
