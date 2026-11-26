export interface MeshData {
  vertices: Float32Array;
  indices: Uint16Array;
}

// Plano en XZ (Suelo) con repetición de UVs
export function createPlane(width: number, depth: number, uvRepeat = 12): MeshData {
  const hw = width / 2;
  const hd = depth / 2;
  const vertices = new Float32Array([
    -hw, 0.0,  hd,   0.0, 1.0, 0.0,   0.0, 0.0,
     hw, 0.0,  hd,   0.0, 1.0, 0.0,   uvRepeat, 0.0,
     hw, 0.0, -hd,   0.0, 1.0, 0.0,   uvRepeat, uvRepeat,
    -hw, 0.0, -hd,   0.0, 1.0, 0.0,   0.0, uvRepeat,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  return { vertices, indices };
}

// Quad vertical en XY (para Billboards y elementos 2D)
export function createQuad(width = 1.0, height = 1.0): MeshData {
  const hw = width / 2;
  const hh = height / 2;
  const vertices = new Float32Array([
    -hw, -hh, 0.0,   0.0, 0.0, 1.0,   0.0, 0.0,
     hw, -hh, 0.0,   0.0, 0.0, 1.0,   1.0, 0.0,
     hw,  hh, 0.0,   0.0, 0.0, 1.0,   1.0, 1.0,
    -hw,  hh, 0.0,   0.0, 0.0, 1.0,   0.0, 1.0,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);

  return { vertices, indices };
}

// Caja centrada en el origen con UVs por cara
export function createBox(width: number, height: number, depth: number): MeshData {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  const vertices = new Float32Array([
    // +Z
    -hw, -hh,  hd,   0,  0,  1,   0, 0,
     hw, -hh,  hd,   0,  0,  1,   1, 0,
     hw,  hh,  hd,   0,  0,  1,   1, 1,
    -hw,  hh,  hd,   0,  0,  1,   0, 1,
    // -Z
     hw, -hh, -hd,   0,  0, -1,   0, 0,
    -hw, -hh, -hd,   0,  0, -1,   1, 0,
    -hw,  hh, -hd,   0,  0, -1,   1, 1,
     hw,  hh, -hd,   0,  0, -1,   0, 1,
    // +X
     hw, -hh,  hd,   1,  0,  0,   0, 0,
     hw, -hh, -hd,   1,  0,  0,   1, 0,
     hw,  hh, -hd,   1,  0,  0,   1, 1,
     hw,  hh,  hd,   1,  0,  0,   0, 1,
    // -X
    -hw, -hh, -hd,  -1,  0,  0,   0, 0,
    -hw, -hh,  hd,  -1,  0,  0,   1, 0,
    -hw,  hh,  hd,  -1,  0,  0,   1, 1,
    -hw,  hh, -hd,  -1,  0,  0,   0, 1,
    // +Y
    -hw,  hh,  hd,   0,  1,  0,   0, 0,
     hw,  hh,  hd,   0,  1,  0,   1, 0,
     hw,  hh, -hd,   0,  1,  0,   1, 1,
    -hw,  hh, -hd,   0,  1,  0,   0, 1,
    // -Y
    -hw, -hh, -hd,   0, -1,  0,   0, 0,
     hw, -hh, -hd,   0, -1,  0,   1, 0,
     hw, -hh,  hd,   0, -1,  0,   1, 1,
    -hw, -hh,  hd,   0, -1,  0,   0, 1,
  ]);

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3,
     4,  5,  6,   4,  6,  7,
     8,  9, 10,   8, 10, 11,
    12, 13, 14,  12, 14, 15,
    16, 17, 18,  16, 18, 19,
    20, 21, 22,  20, 22, 23,
  ]);

  return { vertices, indices };
}

// Esfera con normales y UVs
export function createSphere(radius: number, latitudeBands = 24, longitudeBands = 24): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let lat = 0; lat <= latitudeBands; lat++) {
    const theta = (lat * Math.PI) / latitudeBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    const v = 1 - lat / latitudeBands;

    for (let lon = 0; lon <= longitudeBands; lon++) {
      const phi = (lon * 2 * Math.PI) / longitudeBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const u = lon / longitudeBands;

      const nx = cosPhi * sinTheta;
      const ny = cosTheta;
      const nz = sinPhi * sinTheta;

      vertices.push(radius * nx, radius * ny, radius * nz, nx, ny, nz, u, v);
    }
  }

  for (let lat = 0; lat < latitudeBands; lat++) {
    for (let lon = 0; lon < longitudeBands; lon++) {
      const first = lat * (longitudeBands + 1) + lon;
      const second = first + longitudeBands + 1;

      indices.push(first, first + 1, second);
      indices.push(second, first + 1, second + 1);
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}

// Cilindro alineado en -Z con UVs
export function createCylinder(radius: number, length: number, radialSegments = 20): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= radialSegments; i++) {
    const u = i / radialSegments;
    const angle = u * 2 * Math.PI;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    vertices.push(radius * cosA, radius * sinA, 0, cosA, sinA, 0, u, 0);
    vertices.push(radius * cosA, radius * sinA, -length, cosA, sinA, 0, u, 1);
  }

  for (let i = 0; i < radialSegments; i++) {
    const base1 = i * 2;
    const tip1 = base1 + 1;
    const base2 = (i + 1) * 2;
    const tip2 = base2 + 1;

    indices.push(base1, tip1, base2);
    indices.push(base2, tip1, tip2);
  }

  const tipCenterIndex = vertices.length / 8;
  vertices.push(0, 0, -length, 0, 0, -1, 0.5, 0.5);
  const tipRimStartIndex = vertices.length / 8;
  for (let i = 0; i <= radialSegments; i++) {
    const angle = (i * 2 * Math.PI) / radialSegments;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    vertices.push(radius * cosA, radius * sinA, -length, 0, 0, -1, 0.5 + 0.5 * cosA, 0.5 + 0.5 * sinA);
  }
  for (let i = 0; i < radialSegments; i++) {
    indices.push(tipCenterIndex, tipRimStartIndex + i, tipRimStartIndex + i + 1);
  }

  const baseCenterIndex = vertices.length / 8;
  vertices.push(0, 0, 0, 0, 0, 1, 0.5, 0.5);
  const baseRimStartIndex = vertices.length / 8;
  for (let i = 0; i <= radialSegments; i++) {
    const angle = (i * 2 * Math.PI) / radialSegments;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    vertices.push(radius * cosA, radius * sinA, 0, 0, 0, 1, 0.5 + 0.5 * cosA, 0.5 + 0.5 * sinA);
  }
  for (let i = 0; i < radialSegments; i++) {
    indices.push(baseCenterIndex, baseRimStartIndex + i, baseRimStartIndex + i + 1);
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}