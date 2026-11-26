import { vec3 } from 'gl-matrix';

export interface AABB {
  x: number;
  y: number;
  z: number;
  halfW: number;
  halfH: number;
  halfD: number;
}

/**
 * Verifica colisión entre dos cajas alineadas a los ejes (AABB).
 * Retorna una tupla [colisiona, vectorCorreccion] para sacar a `a` de `b`.
 */
export function checkAABBCollision(a: AABB, b: AABB): [boolean, vec3] {
  const dx = a.x - b.x;
  const px = a.halfW + b.halfW - Math.abs(dx);
  if (px <= 0) return [false, vec3.fromValues(0, 0, 0)];

  const dy = a.y - b.y;
  const py = a.halfH + b.halfH - Math.abs(dy);
  if (py <= 0) return [false, vec3.fromValues(0, 0, 0)];

  const dz = a.z - b.z;
  const pz = a.halfD + b.halfD - Math.abs(dz);
  if (pz <= 0) return [false, vec3.fromValues(0, 0, 0)];

  // Resolver por el eje de menor penetración
  if (px <= py && px <= pz) {
    const sign = dx >= 0 ? 1 : -1;
    return [true, vec3.fromValues(px * sign, 0, 0)];
  }
  if (pz <= px && pz <= py) {
    const sign = dz >= 0 ? 1 : -1;
    return [true, vec3.fromValues(0, 0, pz * sign)];
  }
  const sign = dy >= 0 ? 1 : -1;
  return [true, vec3.fromValues(0, py * sign, 0)];
}