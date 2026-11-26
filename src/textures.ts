import { TEXTURE_UNIT } from './vendor/ff/ff';

export interface GameTextures {
  ground: WebGLTexture;
  crate: WebGLTexture;
  tankCamo: WebGLTexture;
  bush: WebGLTexture;
  sky: WebGLTexture;
}

function uploadCanvasToTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  source: TexImageSource,
  repeat: boolean
): void {
  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
}

function createTextureWithOptionalFile(
  gl: WebGL2RenderingContext,
  fallbackCanvas: HTMLCanvasElement,
  optionalUrl: string,
  repeat: boolean
): WebGLTexture {
  const tex = gl.createTexture()!;
  uploadCanvasToTexture(gl, tex, fallbackCanvas, repeat);

  const img = new Image();
  img.onload = () => {
    uploadCanvasToTexture(gl, tex, img, repeat);
  };
  img.src = optionalUrl;

  return tex;
}

function makeGroundCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;

  // Base de césped en 4 cuadrantes ligeramente alternados (efecto tablero sutil)
  ctx.fillStyle = '#4e7a34';
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#56853a';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillRect(256, 256, 256, 256);

  // Briznas de hierba y textura orgánica
  for (let i = 0; i < 4500; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137 + Math.floor(i / 7) * 19) % 512;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(34, 58, 20, 0.45)' : 'rgba(135, 178, 84, 0.38)';
    ctx.fillRect(x, y, 3, 7);
  }

  // Florecitas silvestres pequeñas (blancas, amarillas y rosadas)
  const flowerColors = ['#fff5f7', '#ffe066', '#ff9ebb'];
  for (let i = 0; i < 95; i++) {
    const fx = (i * 193 + 29) % 500 + 6;
    const fy = (i * 311 + 47) % 500 + 6;
    ctx.fillStyle = flowerColors[i % flowerColors.length];
    ctx.beginPath();
    ctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e09f3e';
    ctx.fillRect(fx - 1, fy - 1, 2, 2);
  }

  // Bordes sutiles de cuadrícula táctica para dar referencia de velocidad y distancia
  ctx.strokeStyle = 'rgba(30, 50, 18, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 509, 509);
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 512);
  ctx.moveTo(0, 256);
  ctx.lineTo(512, 256);
  ctx.stroke();

  return c;
}

function makeCrateCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#9c6b3b';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#7d5229';
  for (let y = 0; y < 256; y += 32) {
    ctx.fillRect(0, y, 256, 3);
  }
  ctx.strokeStyle = '#543518';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 238, 238);

  ctx.beginPath();
  ctx.moveTo(16, 16);
  ctx.lineTo(240, 240);
  ctx.lineWidth = 14;
  ctx.stroke();
  return c;
}

function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.translate(0, -size * 0.5);

  ctx.beginPath();
  const topCurve = size * 0.3;
  ctx.moveTo(0, topCurve);
  ctx.bezierCurveTo(0, 0, -size / 2, 0, -size / 2, topCurve);
  ctx.bezierCurveTo(-size / 2, (size + topCurve) / 2, 0, (size + topCurve) / 1.4, 0, size);
  ctx.bezierCurveTo(0, (size + topCurve) / 1.4, size / 2, (size + topCurve) / 2, size / 2, topCurve);
  ctx.bezierCurveTo(size / 2, 0, 0, 0, 0, topCurve);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// Textura neutra de camuflaje de corazones para teñir el tanque con la tecla V
function makeNeutralCamoCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  // Fondo base claro
  ctx.fillStyle = '#dcdcdc';
  ctx.fillRect(0, 0, 256, 256);

  const shades = ['#ffffff', '#9a9a9a', '#7d7d7d', '#f2f2f2', '#b5b5b5'];
  const step = 42;
  let index = 0;

  for (let y = 20; y < 256; y += step) {
    for (let x = 20; x < 256; x += step) {
      const offsetX = (Math.floor(y / step) % 2) * 18;
      const px = (x + offsetX) % 256;
      const size = 22 + (index % 3) * 6;
      const angle = ((index * 0.7) % 1.2) - 0.6;

      ctx.fillStyle = shades[index % shades.length];
      drawHeart(ctx, px, y, size, angle);
      index++;
    }
  }

  return c;
}
// Textura con transparencia alfa para los billboards cilíndricos
function makeBushCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  const blobs = [
    { x: 128, y: 155, r: 72, color: '#2d5e24' },
    { x: 82, y: 175, r: 54, color: '#38732c' },
    { x: 174, y: 175, r: 54, color: '#38732c' },
    { x: 105, y: 125, r: 52, color: '#478f38' },
    { x: 152, y: 130, r: 50, color: '#4ea13d' },
    { x: 128, y: 165, r: 46, color: '#5cb848' },
  ];

  for (const b of blobs) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function makeSkyCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#1e5fa8');
  grad.addColorStop(0.55, '#6cb4ee');
  grad.addColorStop(0.85, '#cde6fa');
  grad.addColorStop(1.0, '#8aa878');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  const clouds = [
    [90, 160, 48], [130, 155, 38], [165, 165, 32],
    [320, 130, 52], [365, 125, 42], [405, 138, 34],
    [210, 210, 40], [250, 205, 34],
  ];
  for (const [cx, cy, r] of clouds) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

export function createGameTextures(gl: WebGL2RenderingContext): GameTextures {
  return {
    ground: createTextureWithOptionalFile(gl, makeGroundCanvas(), './textures/ground.png', true),
    crate: createTextureWithOptionalFile(gl, makeCrateCanvas(), './textures/Wood_07-512x512.png', false),
    tankCamo: createTextureWithOptionalFile(gl, makeNeutralCamoCanvas(), './textures/camo.png', false),
    bush: createTextureWithOptionalFile(gl, makeBushCanvas(), './textures/Bush_2_YELLOWISH GREEN.png', false),
    sky: createTextureWithOptionalFile(gl, makeSkyCanvas(), './textures/sky.png', false),
  };
}