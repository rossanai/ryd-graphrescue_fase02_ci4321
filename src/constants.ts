// Constantes para la apariencia y configuración de la escena

// Color de fondo #73b3f2 -> RGBA en [0, 1]
export const CLEAR_COLOR: readonly [number, number, number, number] = [0.45, 0.70, 0.95, 1.0];

export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 768;

// 8 floats por vértice: x, y, z, nx, ny, nz, u, v
export const STRIDE_BYTES = 8 * 4;
export const NORMAL_OFFSET_BYTES = 3 * 4;
export const UV_OFFSET_BYTES = 6 * 4;

// Colores para los objetos de la escena
export const COLORS = {
  GROUND: [0.45, 0.28, 0.15, 1.0] as const,
  TURRET_CANNON: [0.15, 0.16, 0.18, 1.0] as const,
  PROJECTILE: [0.05, 0.05, 0.05, 1.0] as const,
  TARGET: [1.0, 0.30, 0.05, 1.0] as const,
  TRAJECTORY_LINE: [1.0, 0.85, 0.1, 0.85] as const,
} as const;

// Paleta de colores seleccionables para el tanque (Tecla V)
export const TANK_PALETTE: readonly (readonly [number, number, number, number])[] = [
  [0.92, 0.42, 0.62, 1.0], // Rosado corazones
  [0.24, 0.34, 0.22, 1.0], // Verde militar
  [0.22, 0.24, 0.26, 1.0], // Gris acero
  [0.65, 0.52, 0.32, 1.0], // Arena desierto
  [0.18, 0.32, 0.55, 1.0], // Azul naval
  [0.68, 0.18, 0.18, 1.0], // Rojo rescate
];

// Dimensiones del escenario
export const FIELD_WIDTH = 60.0;
export const FIELD_DEPTH = 120.0;

// Dimensiones del cañón
export const CANNON_RADIUS = 0.20;
export const CANNON_LENGTH = 2.6;

// Radios
export const TARGET_RADIUS = 1.6;
export const PROJECTILE_RADIUS = 0.32;