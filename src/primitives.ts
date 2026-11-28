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

// Cubo para Skybox (caras apuntando hacia el interior)
export function createSkyboxCube(size = 1.0): MeshData {
  const h = size / 2;

  const vertices = new Float32Array([
    // +Z (frente)
     h, -h,  h,   0,  0, -1,   0, 0,
    -h, -h,  h,   0,  0, -1,   1, 0,
    -h,  h,  h,   0,  0, -1,   1, 1,
     h,  h,  h,   0,  0, -1,   0, 1,
    // -Z (atrás)
    -h, -h, -h,   0,  0,  1,   0, 0,
     h, -h, -h,   0,  0,  1,   1, 0,
     h,  h, -h,   0,  0,  1,   1, 1,
    -h,  h, -h,   0,  0,  1,   0, 1,
    // +X (derecha)
     h, -h, -h,  -1,  0,  0,   0, 0,
     h, -h,  h,  -1,  0,  0,   1, 0,
     h,  h,  h,  -1,  0,  0,   1, 1,
     h,  h, -h,  -1,  0,  0,   0, 1,
    // -X (izquierda)
    -h, -h,  h,   1,  0,  0,   0, 0,
    -h, -h, -h,   1,  0,  0,   1, 0,
    -h,  h, -h,   1,  0,  0,   1, 1,
    -h,  h,  h,   1,  0,  0,   0, 1,
    // +Y (arriba - cielo)
    -h,  h, -h,   0, -1,  0,   0, 0.75,
     h,  h, -h,   0, -1,  0,   1, 0.75,
     h,  h,  h,   0, -1,  0,   1, 1.0,
    -h,  h,  h,   0, -1,  0,   0, 1.0,
    // -Y (abajo - horizonte)
    -h, -h,  h,   0,  1,  0,   0, 0.0,
     h, -h,  h,   0,  1,  0,   1, 0.0,
     h, -h, -h,   0,  1,  0,   1, 0.25,
    -h, -h, -h,   0,  1,  0,   0, 0.25,
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

// Parámetros métricos del mapa de caracteres tipográficos
const FONT_ATLAS_WIDTH = 145;
const FONT_ATLAS_HEIGHT = 1412;
const FONT_CELL_WIDTH = 8;
const FONT_CELL_HEIGHT = 16;
const FONT_PITCH_X = 9;
const FONT_PITCH_Y = 17;
const FONT_BORDER = 1;
const FONT_COLS = 16;
const FONT_FIRST_CODE = 32;
const FONT_LETTER_SPACING = 1;

// Cálculo de coordenadas UV para un glifo individual
export function getGlyphUV(code: number): [number, number, number, number] {
  const safeCode = code >= 32 && code <= 126 ? code : 32;
  const index = safeCode - FONT_FIRST_CODE;
  const col = index % FONT_COLS;
  const row = Math.floor(index / FONT_COLS);
  const x0 = FONT_BORDER + col * FONT_PITCH_X;
  const y0 = FONT_BORDER + row * FONT_PITCH_Y;
  const s0 = x0 / FONT_ATLAS_WIDTH;
  const s1 = (x0 + FONT_CELL_WIDTH) / FONT_ATLAS_WIDTH;
  const t1 = 1 - y0 / FONT_ATLAS_HEIGHT;
  const t0 = 1 - (y0 + FONT_CELL_HEIGHT) / FONT_ATLAS_HEIGHT;
  return [s0, t0, s1, t1];
}

// Generación de malla 2D para cadenas de texto basada en mapa de fuentes
export function createTextMesh(
  text: string,
  scale = 1.0,
  letterSpacing = FONT_LETTER_SPACING
): MeshData {
  const vertices = new Float32Array(text.length * 4 * 8);
  const indices = new Uint16Array(text.length * 6);
  const charWidth = FONT_CELL_WIDTH * scale;
  const charHeight = FONT_CELL_HEIGHT * scale;
  const advance = (FONT_CELL_WIDTH + letterSpacing) * scale;

  for (let i = 0; i < text.length; i++) {
    const [s0, t0, s1, t1] = getGlyphUV(text.charCodeAt(i));
    const left = i * advance;
    const right = left + charWidth;
    const top = 0.0;
    const bottom = charHeight;

    const baseV = i * 4;
    const vOffset = baseV * 8;

    // Vértice 0: inferior izquierdo
    vertices[vOffset + 0] = left;
    vertices[vOffset + 1] = bottom;
    vertices[vOffset + 2] = 0.0;
    vertices[vOffset + 3] = 0.0;
    vertices[vOffset + 4] = 0.0;
    vertices[vOffset + 5] = 1.0;
    vertices[vOffset + 6] = s0;
    vertices[vOffset + 7] = t0;

    // Vértice 1: inferior derecho
    vertices[vOffset + 8] = right;
    vertices[vOffset + 9] = bottom;
    vertices[vOffset + 10] = 0.0;
    vertices[vOffset + 11] = 0.0;
    vertices[vOffset + 12] = 0.0;
    vertices[vOffset + 13] = 1.0;
    vertices[vOffset + 14] = s1;
    vertices[vOffset + 15] = t0;

    // Vértice 2: superior derecho
    vertices[vOffset + 16] = right;
    vertices[vOffset + 17] = top;
    vertices[vOffset + 18] = 0.0;
    vertices[vOffset + 19] = 0.0;
    vertices[vOffset + 20] = 0.0;
    vertices[vOffset + 21] = 1.0;
    vertices[vOffset + 22] = s1;
    vertices[vOffset + 23] = t1;

    // Vértice 3: superior izquierdo
    vertices[vOffset + 24] = left;
    vertices[vOffset + 25] = top;
    vertices[vOffset + 26] = 0.0;
    vertices[vOffset + 27] = 0.0;
    vertices[vOffset + 28] = 0.0;
    vertices[vOffset + 29] = 1.0;
    vertices[vOffset + 30] = s0;
    vertices[vOffset + 31] = t1;

    const iOffset = i * 6;
    indices[iOffset + 0] = baseV;
    indices[iOffset + 1] = baseV + 1;
    indices[iOffset + 2] = baseV + 2;
    indices[iOffset + 3] = baseV;
    indices[iOffset + 4] = baseV + 2;
    indices[iOffset + 5] = baseV + 3;
  }

  return { vertices, indices };
}

// Cuadrilátero 2D con origen en la esquina superior izquierda
export function createQuad2D(width = 1.0, height = 1.0): MeshData {
  const vertices = new Float32Array([
    0.0, height, 0.0,   0.0, 0.0, 1.0,   0.0, 0.0,
    width, height, 0.0, 0.0, 0.0, 1.0,   1.0, 0.0,
    width, 0.0, 0.0,    0.0, 0.0, 1.0,   1.0, 1.0,
    0.0, 0.0, 0.0,      0.0, 0.0, 1.0,   0.0, 1.0,
  ]);
  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3,
  ]);
  return { vertices, indices };
}