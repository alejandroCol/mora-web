export type RingParticleCloud = {
  center: [number, number, number];
  targets: Float32Array;
};

const URL = "/models/ring-particles.bin";

let cloud: RingParticleCloud | null = null;
let pending: Promise<RingParticleCloud> | null = null;

export function preloadRingParticles() {
  if (cloud) return Promise.resolve(cloud);
  if (!pending) {
    pending = fetch(URL)
      .then((res) => {
        if (!res.ok) throw new Error("No se pudo leer el anillo.");
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const data = new Float32Array(buffer);
        cloud = {
          center: [data[0], data[1], data[2]],
          targets: data.subarray(3),
        };
        return cloud;
      });
  }
  return pending;
}

preloadRingParticles();
