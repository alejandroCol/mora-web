"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 10000;

function paintColors(colors: Float32Array, tint?: string) {
  const ink = new THREE.Color("#2a2640");
  const mist = new THREE.Color("#b7b0d4");
  const bloom = new THREE.Color("#ddd8f0");
  const accent = tint ? new THREE.Color(tint) : null;

  for (let i = 0; i < COUNT; i += 1) {
    const tone = Math.random();
    const color =
      tone < 0.45
        ? ink.clone().lerp(mist, tone / 0.45)
        : mist.clone().lerp(bloom, (tone - 0.45) / 0.55);
    if (accent) color.lerp(accent, 0.45);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
}

function scatterFrom(target: Float32Array) {
  const start = new Float32Array(target.length);
  for (let i = 0; i < target.length; i += 3) {
    const scatter = 1.85 + Math.random() * 1.6;
    start[i] = target[i] * scatter + (Math.random() - 0.5) * 1.2;
    start[i + 1] = target[i + 1] * scatter + (Math.random() - 0.5) * 0.9;
    start[i + 2] = target[i + 2] * scatter + (Math.random() - 0.5) * 1.2;
  }
  return start;
}

type ParticleRingProps = {
  targets: Float32Array;
  fading?: boolean;
  replay?: number;
  tint?: string;
  onAssembled?: () => void;
};

export function ParticleRing({
  targets,
  fading = false,
  replay = 0,
  tint,
  onAssembled,
}: ParticleRingProps) {
  const material = useRef<THREE.PointsMaterial>(null);
  const assembled = useRef(false);
  const progress = useRef(0);
  const fade = useRef(1);

  const { positions, start, colors } = useMemo(() => {
    void replay;
    const start = scatterFrom(targets);
    const positions = new Float32Array(start);
    const colors = new Float32Array(COUNT * 3);
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
    progress.current = Math.min(1, progress.current + delta * 0.42);
    const ease = 1 - (1 - progress.current) ** 3;
    const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;

    for (let i = 0; i < COUNT; i += 1) {
      const i3 = i * 3;
      array[i3] = start[i3] + (targets[i3] - start[i3]) * ease;
      array[i3 + 1] = start[i3 + 1] + (targets[i3 + 1] - start[i3 + 1]) * ease;
      array[i3 + 2] = start[i3 + 2] + (targets[i3 + 2] - start[i3 + 2]) * ease;
    }
    attribute.needsUpdate = true;

    if (progress.current >= 1 && !assembled.current) {
      assembled.current = true;
      onAssembled?.();
    }

    fade.current = THREE.MathUtils.lerp(fade.current, fading ? 0 : 1, 0.08);
    if (material.current) {
      material.current.opacity = fade.current * 0.9;
      material.current.size = 0.011 + (1 - ease) * 0.01;
    }
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={material}
        vertexColors
        size={0.013}
        sizeAttenuation
        transparent
        depthWrite={false}
        opacity={0.9}
      />
    </points>
  );
}

export function sampleMesh(root: THREE.Object3D, count = COUNT) {
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
