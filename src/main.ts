import './style.css';
import { mat3, mat4, vec3 } from 'gl-matrix';
import { ATTRIB, createFixedFunction, LIGHTING, TEXTURE_2D, TEXTURE_UNIT } from './vendor/ff/ff';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CLEAR_COLOR,
  COLORS,
  TANK_PALETTE,
  NORMAL_OFFSET_BYTES,
  UV_OFFSET_BYTES,
  STRIDE_BYTES,
  FIELD_WIDTH,
  FIELD_DEPTH,
  TARGET_RADIUS,
  PROJECTILE_RADIUS,
  CANNON_RADIUS,
  CANNON_LENGTH,
} from './constants';
import {
  createPlane,
  createQuad,
  createQuad2D,
  createBox,
  createSkyboxCube,
  createCylinder,
  createSphere,
  createTextMesh,
  MeshData,
} from './primitives';
import { FF, GPUMesh, SceneNode } from './sceneGraph';
import { createGameTextures } from './textures';
import { AABB, checkAABBCollision } from './collision';

interface DynamicLineMesh {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  update: (points: Float32Array, count: number) => void;
  vertexCount: number;
}

function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 is not available.');
  return gl;
}

function uploadMesh(gl: WebGL2RenderingContext, mesh: MeshData): GPUMesh {
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

  const ebo = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);

  gl.enableVertexAttribArray(ATTRIB.NORMAL);
  gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);

  gl.enableVertexAttribArray(ATTRIB.UV);
  gl.vertexAttribPointer(ATTRIB.UV, 2, gl.FLOAT, false, STRIDE_BYTES, UV_OFFSET_BYTES);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bindVertexArray(null);

  return { vao, indexCount: mesh.indices.length };
}

function createDynamicLineMesh(gl: WebGL2RenderingContext, maxVertices = 400): DynamicLineMesh {
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, maxVertices * 3 * Float32Array.BYTES_PER_ELEMENT, gl.DYNAMIC_DRAW);

  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
  gl.bindVertexArray(null);

  const lineMesh: DynamicLineMesh = {
    vao,
    vbo,
    vertexCount: 0,
    update(points: Float32Array, count: number) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, points.subarray(0, count * 3));
      lineMesh.vertexCount = count;
    },
  };

  return lineMesh;
}

interface DynamicTextMesh {
  mesh: GPUMesh;
  setText: (text: string) => void;
}

// Creación de una malla dinámica para textos que cambian en tiempo de ejecución
function createDynamicTextMesh(
  gl: WebGL2RenderingContext,
  initialText = '',
  scale = 2.0
): DynamicTextMesh {
  const vbo = gl.createBuffer()!;
  const ebo = gl.createBuffer()!;
  const vao = gl.createVertexArray()!;

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);

  gl.enableVertexAttribArray(ATTRIB.NORMAL);
  gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);

  gl.enableVertexAttribArray(ATTRIB.UV);
  gl.vertexAttribPointer(ATTRIB.UV, 2, gl.FLOAT, false, STRIDE_BYTES, UV_OFFSET_BYTES);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bindVertexArray(null);

  const mesh: GPUMesh = { vao, indexCount: 0 };

  function setText(text: string): void {
    const data = createTextMesh(text, scale);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data.vertices, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.indices, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    mesh.indexCount = data.indices.length;
  }

  if (initialText) {
    setText(initialText);
  }

  return { mesh, setText };
}

function setupState(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...CLEAR_COLOR);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);
}

function setupLighting(ff: FF): void {
  ff.enable(LIGHTING);
  ff.setGlobalAmbient([0.4, 0.4, 0.42, 1.0]);

  ff.setLight(0, {
    position: [0.6, 1.0, 0.5, 0.0],
    ambient: [0.25, 0.25, 0.25, 1.0],
    diffuse: [1.0, 0.98, 0.92, 1.0],
    specular: [0.5, 0.5, 0.5, 1.0],
  });
  ff.enableLight(0);
}

// Objetivos de la escena
const TARGETS = [
  { x: -10.0, y: 5.5, z: -12.0 },
  { x: 0.0, y: 7.0, z: -26.0 },
  { x: 12.0, y: 8.0, z: -40.0 },
] as const;

// Obstáculos 3D (cajas/paredes) con sus dimensiones para AABB
const OBSTACLE_SPECS = [
  { x: -7.0, y: 1.5, z: 0.0, w: 3.5, h: 3.0, d: 3.5 },
  { x: 8.0, y: 1.5, z: -2.0, w: 4.0, h: 3.0, d: 3.0 },
  { x: 0.0, y: 1.25, z: -10.0, w: 5.0, h: 2.5, d: 2.5 },
  { x: -14.0, y: 2.0, z: -22.0, w: 3.5, h: 4.0, d: 3.5 },
  { x: 14.0, y: 2.0, z: -20.0, w: 3.5, h: 4.0, d: 3.5 },
] as const;

const OBSTACLE_AABBS: AABB[] = OBSTACLE_SPECS.map((o) => ({
  x: o.x,
  y: o.y,
  z: o.z,
  halfW: o.w / 2,
  halfH: o.h / 2,
  halfD: o.d / 2,
}));

// Posiciones de los billboards cilíndricos (arbustos decorativos)
const BUSH_POSITIONS = [
  // Laterales cercanos y medios
  { x: -16.0, z: 18.0, scale: 3.6 },
  { x: 17.0, z: 16.0, scale: 3.4 },
  { x: -23.0, z: 8.0, scale: 4.2 },
  { x: 24.0, z: 6.0, scale: 4.0 },
  { x: -12.0, z: 4.5, scale: 2.7 },
  { x: 13.5, z: 3.5, scale: 2.9 },
  // Junto a los obstáculos
  { x: -10.2, z: -0.5, scale: 2.8 },
  { x: 11.2, z: -2.5, scale: 3.0 },
  { x: -3.6, z: -10.2, scale: 2.5 },
  { x: 3.8, z: -10.0, scale: 2.6 },
  // Zona media y fondo
  { x: -22.0, z: -14.0, scale: 4.4 },
  { x: 22.0, z: -15.0, scale: 4.1 },
  { x: -17.5, z: -23.0, scale: 3.2 },
  { x: 17.5, z: -21.0, scale: 3.3 },
  { x: -25.0, z: -32.0, scale: 4.8 },
  { x: 25.0, z: -34.0, scale: 4.6 },
  { x: -14.0, z: -44.0, scale: 4.2 },
  { x: 0.0, z: -48.0, scale: 4.5 },
  { x: 15.0, z: -45.0, scale: 4.3 },
] as const;

let activeTargets = [true, true, true];
let score = 0;

const MIN_PITCH = 5 * (Math.PI / 180);
const MAX_PITCH = 80 * (Math.PI / 180);

const TANK = {
  x: 0.0,
  z: 14.0,
  yaw: 0.0,
  turretYaw: 0.0,
  pitchAngle: 25 * (Math.PI / 180),
  moveSpeed: 12.0,
  turnSpeed: 1.8,
  turretSpeed: 2.0,
  pitchSpeed: 1.1,
  colorIndex: 0,
  halfW: 1.5,
  halfH: 1.1,
  halfD: 1.8,
};

type CameraMode = 0 | 1 | 2;
let currentCamera: CameraMode = 0;

const PROJECTILE = {
  isFlying: false,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
};

let powerLevel = 1;
const LAUNCH_SPEEDS = [0, 22.0, 32.0, 44.0];
const GRAVITY = -24.0;

const keysPressed: Record<string, boolean> = {};
const TRACKED_KEYS = new Set([
  'w', 'W', 'a', 'A', 's', 'S', 'd', 'D',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  '1', '2', '3', 'f', 'F', ' ', 'r', 'R', 'c', 'C', 'v', 'V',
]);

function run(canvas: HTMLCanvasElement): void {
  const gl = getContext(canvas);
  const ff = createFixedFunction(gl, { debug: true });
  const textures = createGameTextures(gl);

  const meshes = {
    ground: uploadMesh(gl, createPlane(FIELD_WIDTH, FIELD_DEPTH, 16)),
    box: uploadMesh(gl, createBox(1.0, 1.0, 1.0)),
    skybox: uploadMesh(gl, createSkyboxCube(160.0)),
    quad: uploadMesh(gl, createQuad(1.0, 1.0)),
    sphere: uploadMesh(gl, createSphere(TARGET_RADIUS, 28, 28)),
    cylinder: uploadMesh(gl, createCylinder(CANNON_RADIUS, CANNON_LENGTH, 28)),
    trajectory: createDynamicLineMesh(gl, 400),
    uiPanel: uploadMesh(gl, createQuad2D(1.0, 1.0)),
    camThirdPerson: uploadMesh(gl, createTextMesh('CAM: TERCERA PERSONA', 1.5)),
    camCenital: uploadMesh(gl, createTextMesh('CAM: CENITAL', 1.5)),
    camFirstPerson: uploadMesh(gl, createTextMesh('CAM: PRIMERA PERSONA', 1.5)),
  };

  // --- ÁRBOL DE ESCENA OPACO ---
  const sceneRoot = new SceneNode();

  // Suelo texturizado
  const groundNode = new SceneNode();
  groundNode.mesh = meshes.ground;
  groundNode.texture = textures.ground;
  groundNode.color = [1.0, 1.0, 1.0, 1.0];
  groundNode.shininess = 5;
  sceneRoot.addChild(groundNode);

  // Obstáculos 3D texturizados
  for (const obs of OBSTACLE_SPECS) {
    const obsNode = new SceneNode();
    obsNode.position = vec3.fromValues(obs.x, obs.y, obs.z);
    obsNode.scale = vec3.fromValues(obs.w, obs.h, obs.d);
    obsNode.mesh = meshes.box;
    obsNode.texture = textures.crate;
    obsNode.color = [1.0, 1.0, 1.0, 1.0];
    obsNode.shininess = 15;
    sceneRoot.addChild(obsNode);
  }

  // Objetivos
  const targetNodes = TARGETS.map((t) => {
    const node = new SceneNode();
    node.position = vec3.fromValues(t.x, t.y, t.z);
    node.mesh = meshes.sphere;
    node.color = COLORS.TARGET;
    node.shininess = 35;
    sceneRoot.addChild(node);
    return node;
  });

  // Jerarquía del Tanque (con textura neutra teñida por el color activo)
  const tankBaseNode = new SceneNode();
  sceneRoot.addChild(tankBaseNode);

  const bodyHeight = 1.6;
  const tankBodyMeshNode = new SceneNode();
  tankBodyMeshNode.position = vec3.fromValues(0, bodyHeight / 2, 0);
  tankBodyMeshNode.scale = vec3.fromValues(2.6, bodyHeight, 3.4);
  tankBodyMeshNode.mesh = meshes.box;
  tankBodyMeshNode.texture = textures.tankCamo;
  tankBodyMeshNode.color = TANK_PALETTE[TANK.colorIndex];
  tankBaseNode.addChild(tankBodyMeshNode);

  const barOffsetsX = [-0.65, 0.0, 0.65];
  const powerBarNodes = barOffsetsX.map((ox) => {
    const bar = new SceneNode();
    bar.position = vec3.fromValues(ox, bodyHeight / 2, 1.72);
    bar.scale = vec3.fromValues(0.45, 0.25, 0.08);
    bar.mesh = meshes.box;
    bar.shininess = 10;
    tankBaseNode.addChild(bar);
    return bar;
  });

  const turretHeadNode = new SceneNode();
  turretHeadNode.position = vec3.fromValues(0, bodyHeight + 0.3, 0);
  tankBaseNode.addChild(turretHeadNode);

  const jointScale = 0.75 / TARGET_RADIUS;
  const turretDomeNode = new SceneNode();
  turretDomeNode.scale = vec3.fromValues(jointScale * 1.3, jointScale, jointScale * 1.3);
  turretDomeNode.mesh = meshes.sphere;
  turretDomeNode.texture = textures.tankCamo;
  turretDomeNode.color = TANK_PALETTE[TANK.colorIndex];
  turretHeadNode.addChild(turretDomeNode);

  const cannonPivotNode = new SceneNode();
  turretHeadNode.addChild(cannonPivotNode);

  const cannonBarrelNode = new SceneNode();
  cannonBarrelNode.mesh = meshes.cylinder;
  cannonBarrelNode.color = COLORS.TURRET_CANNON;
  cannonBarrelNode.shininess = 30;
  cannonPivotNode.addChild(cannonBarrelNode);

  const muzzleNode = new SceneNode();
  muzzleNode.position = vec3.fromValues(0, 0, -CANNON_LENGTH);
  cannonPivotNode.addChild(muzzleNode);

  const projScale = PROJECTILE_RADIUS / TARGET_RADIUS;
  const attachedProjectileNode = new SceneNode();
  attachedProjectileNode.scale = vec3.fromValues(projScale, projScale, projScale);
  attachedProjectileNode.mesh = meshes.sphere;
  attachedProjectileNode.color = COLORS.PROJECTILE;
  attachedProjectileNode.shininess = 40;
  muzzleNode.addChild(attachedProjectileNode);

  const flyingProjectileNode = new SceneNode();
  flyingProjectileNode.scale = vec3.fromValues(projScale, projScale, projScale);
  flyingProjectileNode.mesh = meshes.sphere;
  flyingProjectileNode.color = COLORS.PROJECTILE;
  flyingProjectileNode.shininess = 40;
  flyingProjectileNode.visible = false;
  sceneRoot.addChild(flyingProjectileNode);

  // --- ÁRBOL DE BILLBOARDS CILÍNDRICOS (Transparentes) ---
  const billboardRoot = new SceneNode();
  const bushNodes = BUSH_POSITIONS.map((b) => {
    const node = new SceneNode();
    node.position = vec3.fromValues(b.x, b.scale / 2, b.z);
    node.scale = vec3.fromValues(b.scale, b.scale, 1.0);
    node.mesh = meshes.quad;
    node.texture = textures.bush;
    node.color = [1.0, 1.0, 1.0, 1.0];
    node.shininess = 5;
    billboardRoot.addChild(node);
    return node;
  });

  // --- ÁRBOL DE ESCENA PARA LA INTERFAZ 2D ---
  const uiRoot = new SceneNode();

  // Contenedor de la cámara actual en la esquina superior izquierda
  const cameraHudNode = new SceneNode();
  cameraHudNode.position = vec3.fromValues(16, 16, 0);
  uiRoot.addChild(cameraHudNode);

  // Fondo semitransparente para legibilidad
  const cameraPanelNode = new SceneNode();
  cameraPanelNode.position = vec3.fromValues(-10, -5, 0);
  cameraPanelNode.scale = vec3.fromValues(290, 34, 1.0);
  cameraPanelNode.mesh = meshes.uiPanel;
  cameraPanelNode.color = [0.0, 0.0, 0.0, 0.6];
  cameraHudNode.addChild(cameraPanelNode);

  // Etiqueta para cámara en tercera persona
  const camThirdPersonNode = new SceneNode();
  camThirdPersonNode.mesh = meshes.camThirdPerson;
  camThirdPersonNode.texture = textures.font;
  camThirdPersonNode.color = [1.0, 1.0, 1.0, 1.0];
  cameraHudNode.addChild(camThirdPersonNode);

  // Etiqueta para cámara cenital
  const camCenitalNode = new SceneNode();
  camCenitalNode.mesh = meshes.camCenital;
  camCenitalNode.texture = textures.font;
  camCenitalNode.color = [1.0, 1.0, 1.0, 1.0];
  cameraHudNode.addChild(camCenitalNode);

  // Etiqueta para cámara en primera persona
  const camFirstPersonNode = new SceneNode();
  camFirstPersonNode.mesh = meshes.camFirstPerson;
  camFirstPersonNode.texture = textures.font;
  camFirstPersonNode.color = [1.0, 1.0, 1.0, 1.0];
  cameraHudNode.addChild(camFirstPersonNode);

  // Malla dinámica para el texto de puntaje
  const dynamicScore = createDynamicTextMesh(gl, 'PUNTAJE: 0', 1.5);
  let displayedScore = -1;

  // Contenedor del puntaje en la parte superior central
  const scoreHudNode = new SceneNode();
  scoreHudNode.position = vec3.fromValues(Math.round((CANVAS_WIDTH - 135) / 2), 16, 0);
  uiRoot.addChild(scoreHudNode);

  // Panel de fondo para el puntaje
  const scorePanelNode = new SceneNode();
  scorePanelNode.position = vec3.fromValues(-10, -5, 0);
  scorePanelNode.scale = vec3.fromValues(155, 34, 1.0);
  scorePanelNode.mesh = meshes.uiPanel;
  scorePanelNode.color = [0.0, 0.0, 0.0, 0.6];
  scoreHudNode.addChild(scorePanelNode);

  // Texto del puntaje con mapeo de textura tipográfica
  const scoreTextNode = new SceneNode();
  scoreTextNode.mesh = dynamicScore.mesh;
  scoreTextNode.texture = textures.font;
  scoreTextNode.color = [1.0, 1.0, 1.0, 1.0];
  scoreHudNode.addChild(scoreTextNode);

  const pivotWorldPos = vec3.create();
  const muzzleWorldPos = vec3.create();
  const cannonDir = vec3.create();

  function getMuzzleSpawnAndDirection(): void {
    cannonPivotNode.getWorldPosition(pivotWorldPos);
    muzzleNode.getWorldPosition(muzzleWorldPos);
    vec3.sub(cannonDir, muzzleWorldPos, pivotWorldPos);
    vec3.normalize(cannonDir, cannonDir);
  }

  function fireProjectile(): void {
    getMuzzleSpawnAndDirection();
    PROJECTILE.isFlying = true;
    PROJECTILE.x = muzzleWorldPos[0];
    PROJECTILE.y = muzzleWorldPos[1];
    PROJECTILE.z = muzzleWorldPos[2];

    const speed = LAUNCH_SPEEDS[powerLevel];
    PROJECTILE.vx = cannonDir[0] * speed;
    PROJECTILE.vy = cannonDir[1] * speed;
    PROJECTILE.vz = cannonDir[2] * speed;
  }

  function resetGame(): void {
    PROJECTILE.isFlying = false;
    activeTargets = [true, true, true];
    score = 0;
    TANK.x = 0.0;
    TANK.z = 14.0;
    TANK.yaw = 0.0;
    TANK.turretYaw = 0.0;
    TANK.pitchAngle = 25 * (Math.PI / 180);
    currentCamera = 0;
  }

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!TRACKED_KEYS.has(e.key)) return;
    keysPressed[e.key] = true;
    e.preventDefault();

    if (e.repeat) return;

    if (e.key === '1') powerLevel = 1;
    if (e.key === '2') powerLevel = 2;
    if (e.key === '3') powerLevel = 3;
    if (e.key.toLowerCase() === 'f') powerLevel = powerLevel === 3 ? 1 : powerLevel + 1;

    if (e.key === ' ' && !PROJECTILE.isFlying) {
      fireProjectile();
    }
    if (e.key.toLowerCase() === 'r') {
      resetGame();
    }
    if (e.key.toLowerCase() === 'c') {
      currentCamera = ((currentCamera + 1) % 3) as CameraMode;
    }
    if (e.key.toLowerCase() === 'v') {
      TANK.colorIndex = (TANK.colorIndex + 1) % TANK_PALETTE.length;
      const newColor = TANK_PALETTE[TANK.colorIndex];
      tankBodyMeshNode.color = newColor;
      turretDomeNode.color = newColor;
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    if (TRACKED_KEYS.has(e.key)) {
      keysPressed[e.key] = false;
      e.preventDefault();
    }
  });

  const trajectoryBuffer = new Float32Array(400 * 3);

  function updateTrajectoryPreview(): void {
    if (PROJECTILE.isFlying) {
      meshes.trajectory.vertexCount = 0;
      return;
    }

    getMuzzleSpawnAndDirection();
    const speed = LAUNCH_SPEEDS[powerLevel];

    let simX = muzzleWorldPos[0];
    let simY = muzzleWorldPos[1];
    let simZ = muzzleWorldPos[2];
    const simVx = cannonDir[0] * speed;
    let simVy = cannonDir[1] * speed;
    const simVz = cannonDir[2] * speed;

    const simDt = 0.016;
    let count = 0;

    trajectoryBuffer[0] = simX;
    trajectoryBuffer[1] = simY;
    trajectoryBuffer[2] = simZ;
    count++;

    while (simY >= PROJECTILE_RADIUS && count < 399) {
      simVy += GRAVITY * simDt;
      simX += simVx * simDt;
      simY += simVy * simDt;
      simZ += simVz * simDt;

      trajectoryBuffer[count * 3 + 0] = simX;
      trajectoryBuffer[count * 3 + 1] = simY;
      trajectoryBuffer[count * 3 + 2] = simZ;
      count++;
    }

    meshes.trajectory.update(trajectoryBuffer, count);
  }

  const viewMatrix = mat4.create();
  const cameraEyePos = vec3.create();
  const projectionMatrix = mat4.perspective(
    mat4.create(),
    Math.PI / 3.6,
    CANVAS_WIDTH / CANVAS_HEIGHT,
    0.1,
    300.0
  );
  const hudProjectionMatrix = mat4.ortho(
    mat4.create(),
    0,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    0,
    -1.0,
    1.0
  );
  const identityMat3 = mat3.create();

  function updateCamera(): void {
    const fwdX = -Math.sin(TANK.yaw);
    const fwdZ = -Math.cos(TANK.yaw);

    if (currentCamera === 0) {
      vec3.set(cameraEyePos, TANK.x - fwdX * 13.0, 6.5, TANK.z - fwdZ * 13.0);
      mat4.lookAt(
        viewMatrix,
        cameraEyePos,
        [TANK.x + fwdX * 4.0, 2.2, TANK.z + fwdZ * 4.0],
        [0, 1, 0]
      );
    } else if (currentCamera === 1) {
      vec3.set(cameraEyePos, TANK.x, 32.0, TANK.z);
      mat4.lookAt(
        viewMatrix,
        cameraEyePos,
        [TANK.x, 0.0, TANK.z],
        [0, 0, -1]
      );
    } else {
      getMuzzleSpawnAndDirection();
      vec3.set(
        cameraEyePos,
        muzzleWorldPos[0] + cannonDir[0] * 0.25,
        muzzleWorldPos[1] + cannonDir[1] * 0.25,
        muzzleWorldPos[2] + cannonDir[2] * 0.25
      );
      mat4.lookAt(
        viewMatrix,
        cameraEyePos,
        [
          cameraEyePos[0] + cannonDir[0] * 10.0,
          cameraEyePos[1] + cannonDir[1] * 10.0,
          cameraEyePos[2] + cannonDir[2] * 10.0,
        ],
        [0, 1, 0]
      );
    }

    ff.setViewMatrix(viewMatrix);
    ff.setProjectionMatrix(projectionMatrix);
  }

  function update(dt: number): void {
    if (keysPressed['a'] || keysPressed['A']) TANK.yaw += TANK.turnSpeed * dt;
    if (keysPressed['d'] || keysPressed['D']) TANK.yaw -= TANK.turnSpeed * dt;

    const fwdX = -Math.sin(TANK.yaw);
    const fwdZ = -Math.cos(TANK.yaw);

    if (keysPressed['w'] || keysPressed['W']) {
      TANK.x += fwdX * TANK.moveSpeed * dt;
      TANK.z += fwdZ * TANK.moveSpeed * dt;
    }
    if (keysPressed['s'] || keysPressed['S']) {
      TANK.x -= fwdX * TANK.moveSpeed * dt;
      TANK.z -= fwdZ * TANK.moveSpeed * dt;
    }

    // Límites del mapa
    const maxHalfW = FIELD_WIDTH / 2 - 2.0;
    const maxHalfD = FIELD_DEPTH / 2 - 2.0;
    TANK.x = Math.max(-maxHalfW, Math.min(maxHalfW, TANK.x));
    TANK.z = Math.max(-maxHalfD, Math.min(maxHalfD, TANK.z));

    // Colisión AABB Tanque vs Obstáculos
    const tankBox: AABB = {
      x: TANK.x,
      y: TANK.halfH,
      z: TANK.z,
      halfW: TANK.halfW,
      halfH: TANK.halfH,
      halfD: TANK.halfD,
    };

    for (const obsBox of OBSTACLE_AABBS) {
      const [hit, correction] = checkAABBCollision(tankBox, obsBox);
      if (hit) {
        TANK.x += correction[0];
        TANK.z += correction[2];
        tankBox.x = TANK.x;
        tankBox.z = TANK.z;
      }
    }

    if (keysPressed['ArrowLeft']) TANK.turretYaw += TANK.turretSpeed * dt;
    if (keysPressed['ArrowRight']) TANK.turretYaw -= TANK.turretSpeed * dt;

    if (keysPressed['ArrowUp']) TANK.pitchAngle += TANK.pitchSpeed * dt;
    if (keysPressed['ArrowDown']) TANK.pitchAngle -= TANK.pitchSpeed * dt;
    TANK.pitchAngle = Math.max(MIN_PITCH, Math.min(MAX_PITCH, TANK.pitchAngle));

    tankBaseNode.position[0] = TANK.x;
    tankBaseNode.position[2] = TANK.z;
    tankBaseNode.rotation[1] = TANK.yaw;

    turretHeadNode.rotation[1] = TANK.turretYaw;
    cannonPivotNode.rotation[0] = TANK.pitchAngle;

    for (let b = 0; b < 3; b++) {
      powerBarNodes[b].color = b + 1 <= powerLevel ? [0.2, 0.9, 0.2, 1.0] : [0.0, 0.4, 0.0, 1.0];
    }

    attachedProjectileNode.visible = !PROJECTILE.isFlying && currentCamera !== 2;

    sceneRoot.updateWorldMatrix();

    // Física del proyectil
    if (PROJECTILE.isFlying) {
      PROJECTILE.vy += GRAVITY * dt;
      PROJECTILE.x += PROJECTILE.vx * dt;
      PROJECTILE.y += PROJECTILE.vy * dt;
      PROJECTILE.z += PROJECTILE.vz * dt;

      if (PROJECTILE.y <= PROJECTILE_RADIUS) {
        PROJECTILE.isFlying = false;
      }

      // Colisión proyectil vs obstáculos AABB
      const projBox: AABB = {
        x: PROJECTILE.x,
        y: PROJECTILE.y,
        z: PROJECTILE.z,
        halfW: PROJECTILE_RADIUS,
        halfH: PROJECTILE_RADIUS,
        halfD: PROJECTILE_RADIUS,
      };
      for (const obsBox of OBSTACLE_AABBS) {
        const [hitObs] = checkAABBCollision(projBox, obsBox);
        if (hitObs) {
          PROJECTILE.isFlying = false;
          break;
        }
      }

      // Colisión proyectil vs objetivos esféricos
      if (PROJECTILE.isFlying) {
        for (let i = 0; i < TARGETS.length; i++) {
          if (!activeTargets[i]) continue;
          const t = TARGETS[i];
          const dx = PROJECTILE.x - t.x;
          const dy = PROJECTILE.y - t.y;
          const dz = PROJECTILE.z - t.z;
          if (Math.hypot(dx, dy, dz) <= TARGET_RADIUS + PROJECTILE_RADIUS) {
            activeTargets[i] = false;
            targetNodes[i].visible = false;
            PROJECTILE.isFlying = false;
            score += 100;
            break;
          }
        }
      }
    }

    for (let i = 0; i < TARGETS.length; i++) {
      targetNodes[i].visible = activeTargets[i];
    }

    flyingProjectileNode.visible = PROJECTILE.isFlying;
    if (PROJECTILE.isFlying) {
      flyingProjectileNode.position[0] = PROJECTILE.x;
      flyingProjectileNode.position[1] = PROJECTILE.y;
      flyingProjectileNode.position[2] = PROJECTILE.z;
      flyingProjectileNode.updateWorldMatrix();
    }

    // Actualización de visibilidad de las etiquetas de la interfaz según la cámara activa
    camThirdPersonNode.visible = currentCamera === 0;
    camCenitalNode.visible = currentCamera === 1;
    camFirstPersonNode.visible = currentCamera === 2;
    cameraPanelNode.scale[0] = currentCamera === 1 ? 182 : 290;

    // Actualización y centrado dinámico del puntaje
    if (score !== displayedScore) {
      displayedScore = score;
      const scoreText = `PUNTAJE: ${score}`;
      dynamicScore.setText(scoreText);
      const scoreWidth = scoreText.length * 13.5;
      scoreHudNode.position[0] = Math.round((CANVAS_WIDTH - scoreWidth) / 2);
      scorePanelNode.scale[0] = scoreWidth + 20;
    }

    uiRoot.updateWorldMatrix();
  }

  const normalMatScratch = mat3.create();
  const identityMat4 = mat4.create();
  const skyboxModelMat = mat4.create();

  function render(): void {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    updateCamera();

    // 1. Dibujar Skybox centrado en la cámara activa
    gl.depthMask(false);
    ff.disable(LIGHTING);
    ff.enable(TEXTURE_2D);
    ff.setColor([1.0, 1.0, 1.0, 1.0]);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, textures.sky);
    mat4.fromTranslation(skyboxModelMat, cameraEyePos);
    ff.setModelMatrix(skyboxModelMat);
    gl.bindVertexArray(meshes.skybox.vao);
    ff.drawElements(gl.TRIANGLES, meshes.skybox.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);
    ff.enable(LIGHTING);

    // 2. Dibujar objetos opacos del árbol de escena
    sceneRoot.render(gl, ff, normalMatScratch);

    // 3. Previsualización de trayectoria
    if (!PROJECTILE.isFlying && meshes.trajectory.vertexCount > 1) {
      ff.disable(LIGHTING);
      ff.disable(TEXTURE_2D);
      ff.setColor(COLORS.TRAJECTORY_LINE);
      ff.setModelMatrix(identityMat4);

      gl.bindVertexArray(meshes.trajectory.vao);
      ff.drawArrays(gl.LINE_STRIP, 0, meshes.trajectory.vertexCount);
      ff.enable(LIGHTING);
    }

// 4. Rotación cilíndrica en Y + ordenamiento back-to-front para transparencia limpia
    for (const bush of bushNodes) {
      bush.rotation[1] = Math.atan2(
        cameraEyePos[0] - bush.position[0],
        cameraEyePos[2] - bush.position[2]
      );
    }
    billboardRoot.children.sort((a, b) => {
      const distA =
        (a.position[0] - cameraEyePos[0]) ** 2 + (a.position[2] - cameraEyePos[2]) ** 2;
      const distB =
        (b.position[0] - cameraEyePos[0]) ** 2 + (b.position[2] - cameraEyePos[2]) ** 2;
      return distB - distA;
    });
    billboardRoot.updateWorldMatrix();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    billboardRoot.render(gl, ff, normalMatScratch);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    // 5. Capa 2D de interfaz gráfica con cámara ortográfica superpuesta
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    ff.disable(LIGHTING);
    ff.setProjectionMatrix(hudProjectionMatrix);
    ff.setViewMatrix(identityMat4);
    ff.setTextureMatrix(identityMat3);

    uiRoot.render(gl, ff, normalMatScratch);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    ff.enable(LIGHTING);
  }

  setupState(gl, canvas);
  setupLighting(ff);

  let lastTime = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    update(dt);
    updateTrajectoryPreview();
    render();
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas);