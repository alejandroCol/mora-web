import * as THREE from "three";

/** Abombado del perfil (comfort fit): 0 = cilindro recto, reflejo en línea dura. */
const DOME = 0.38;

/** Eje del anillo en el espacio local de una malla. La carcasa viene en varias piezas; todas comparten eje. */
export type BandFrame = {
  center: THREE.Vector3;
  axis: THREE.Vector3;
  halfHeight: number;
};

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Marco común de las piezas. El eje es la dimensión más corta de la caja: el ancho de banda, nunca el diámetro. */
export function bandFrames(root: THREE.Object3D, meshes: THREE.Mesh[]): BandFrame[] {
  root.updateWorldMatrix(true, true);
  const toRoot = root.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox();
    const local = mesh.geometry.boundingBox!.clone();
    box.union(local.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld)));
  }
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const axisIndex = size.x <= size.y && size.x <= size.z ? 0 : size.y <= size.z ? 1 : 2;
  const halfHeight = Math.max(1e-6, size.getComponent(axisIndex) / 2);
  const rootAxis = new THREE.Vector3().setComponent(axisIndex, halfHeight);

  return meshes.map((mesh) => {
    const toLocal = new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld).invert();
    const localCenter = center.clone().applyMatrix4(toLocal);
    const top = center.clone().add(rootAxis).applyMatrix4(toLocal);
    const axis = top.clone().sub(localCenter);
    return { center: localCenter, axis: axis.clone().normalize(), halfHeight: axis.length() };
  });
}

/**
 * Normales de banda ideal: cara exterior e interior pasan a cilindro con leve abombado;
 * cantos y biseles se mezclan sin escalón con las originales.
 */
export function idealBandNormals(geometry: THREE.BufferGeometry, frame: BandFrame) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const { center, axis, halfHeight } = frame;

  const out = new Float32Array(normal.count * 3);
  const source = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const ideal = new THREE.Vector3();

  for (let i = 0; i < normal.count; i += 1) {
    source.fromBufferAttribute(normal, i).normalize();
    radial.fromBufferAttribute(position, i).sub(center);
    const height = radial.dot(axis);
    radial.addScaledVector(axis, -height);
    const radius = radial.length();
    let blend = 0;

    if (radius > 1e-6) {
      radial.divideScalar(radius);
      const facing = source.dot(radial);
      const side = Math.sign(facing) || 1;
      blend = smoothstep(0.55, 0.88, Math.abs(facing));
      // Convexo por fuera y por dentro: arriba la normal sube en ambas caras.
      ideal
        .copy(radial)
        .multiplyScalar(side)
        .addScaledVector(axis, (height / halfHeight) * DOME)
        .normalize();
    }

    source.lerp(ideal, blend).normalize();
    out[i * 3] = source.x;
    out[i * 3 + 1] = source.y;
    out[i * 3 + 2] = source.z;
  }

  return out;
}
