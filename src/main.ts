import './style.css';
import { mat3, mat4, vec3 } from 'gl-matrix';
import { ATTRIB, createFixedFunction, LIGHTING } from './vendor/ff/ff';
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
  createBox,
  createCylinder,
  createSphere,
  MeshData,
} from './primitives';
import { FF, GPUMesh, SceneNode } from './sceneGraph';

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
  ff.setGlobalAmbient([0.35, 0.35, 0.38, 1.0]);

  ff.setLight(0, {
    position: [0.6, 1.0, 0.5, 0.0],
    ambient: [0.2, 0.2, 0.2, 1.0],
    diffuse: [1.0, 0.98, 0.92, 1.0],
    specular: [0.6, 0.6, 0.6, 1.0],
  });
  ff.enableLight(0);
}

// Objetivos de la escena
const TARGETS = [
  { x: -8.0, y: 5.5, z: -12.0 },
  { x: 0.0, y: 7.0, z: -24.0 },
  { x: 10.0, y: 8.0, z: -38.0 },
] as const;

let activeTargets = [true, true, true];
let score = 0;

// Estado del tanque
const MIN_PITCH = 5 * (Math.PI / 180);
const MAX_PITCH = 80 * (Math.PI / 180);

const TANK = {
  x: 0.0,
  z: 10.0,
  yaw: 0.0,         // Rotación de la base (A/D)
  turretYaw: 0.0,   // Rotación de la torreta relativa a la base (Flechas Izq/Der)
  pitchAngle: 25 * (Math.PI / 180), // Elevación del cañón (Flechas Arr/Abj)
  moveSpeed: 12.0,
  turnSpeed: 1.8,
  turretSpeed: 2.0,
  pitchSpeed: 1.1,
  colorIndex: 0,
};

// Cámaras: 0 = Tercera Persona, 1 = Cenital, 2 = Primera Persona
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

  const meshes = {
    ground: uploadMesh(gl, createPlane(FIELD_WIDTH, FIELD_DEPTH, 16)),
    box: uploadMesh(gl, createBox(1.0, 1.0, 1.0)),
    sphere: uploadMesh(gl, createSphere(TARGET_RADIUS, 28, 28)),
    cylinder: uploadMesh(gl, createCylinder(CANNON_RADIUS, CANNON_LENGTH, 28)),
    trajectory: createDynamicLineMesh(gl, 400),
  };

  // --- CONSTRUCCIÓN DEL ÁRBOL DE ESCENA ---
  const sceneRoot = new SceneNode();

  // Suelo
  const groundNode = new SceneNode();
  groundNode.mesh = meshes.ground;
  groundNode.color = COLORS.GROUND;
  groundNode.shininess = 5;
  sceneRoot.addChild(groundNode);

  // Nodos de Objetivos
  const targetNodes = TARGETS.map((t) => {
    const node = new SceneNode();
    node.position = vec3.fromValues(t.x, t.y, t.z);
    node.mesh = meshes.sphere;
    node.color = COLORS.TARGET;
    node.shininess = 35;
    sceneRoot.addChild(node);
    return node;
  });

  // Jerarquía del Tanque: Base -> Torreta -> Cañón -> Punta
  const tankBaseNode = new SceneNode();
  sceneRoot.addChild(tankBaseNode);

  const bodyHeight = 1.6;
  const tankBodyMeshNode = new SceneNode();
  tankBodyMeshNode.position = vec3.fromValues(0, bodyHeight / 2, 0);
  tankBodyMeshNode.scale = vec3.fromValues(2.6, bodyHeight, 3.4);
  tankBodyMeshNode.mesh = meshes.box;
  tankBodyMeshNode.color = TANK_PALETTE[TANK.colorIndex];
  tankBaseNode.addChild(tankBodyMeshNode);

  // Indicadores de fuerza en la parte trasera del tanque
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

  // Torreta giratoria sobre la base
  const turretHeadNode = new SceneNode();
  turretHeadNode.position = vec3.fromValues(0, bodyHeight + 0.3, 0);
  tankBaseNode.addChild(turretHeadNode);

  const jointScale = 0.75 / TARGET_RADIUS;
  const turretDomeNode = new SceneNode();
  turretDomeNode.scale = vec3.fromValues(jointScale * 1.3, jointScale, jointScale * 1.3);
  turretDomeNode.mesh = meshes.sphere;
  turretDomeNode.color = TANK_PALETTE[TANK.colorIndex];
  turretHeadNode.addChild(turretDomeNode);

  // Pivote del cañón (inclinación vertical)
  const cannonPivotNode = new SceneNode();
  turretHeadNode.addChild(cannonPivotNode);

  const cannonBarrelNode = new SceneNode();
  cannonBarrelNode.mesh = meshes.cylinder;
  cannonBarrelNode.color = COLORS.TURRET_CANNON;
  cannonBarrelNode.shininess = 30;
  cannonPivotNode.addChild(cannonBarrelNode);

  // Nodo vacío en la punta exacta del cañón
  const muzzleNode = new SceneNode();
  muzzleNode.position = vec3.fromValues(0, 0, -CANNON_LENGTH);
  cannonPivotNode.addChild(muzzleNode);

  // Proyectil listo en la boca del cañón
  const projScale = PROJECTILE_RADIUS / TARGET_RADIUS;
  const attachedProjectileNode = new SceneNode();
  attachedProjectileNode.scale = vec3.fromValues(projScale, projScale, projScale);
  attachedProjectileNode.mesh = meshes.sphere;
  attachedProjectileNode.color = COLORS.PROJECTILE;
  attachedProjectileNode.shininess = 40;
  muzzleNode.addChild(attachedProjectileNode);

  // Proyectil en vuelo (hijo directo de sceneRoot en coordenadas de mundo)
  const flyingProjectileNode = new SceneNode();
  flyingProjectileNode.scale = vec3.fromValues(projScale, projScale, projScale);
  flyingProjectileNode.mesh = meshes.sphere;
  flyingProjectileNode.color = COLORS.PROJECTILE;
  flyingProjectileNode.shininess = 40;
  flyingProjectileNode.visible = false;
  sceneRoot.addChild(flyingProjectileNode);

  // Vectores auxiliares para cálculos 3D
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
    TANK.z = 10.0;
    TANK.yaw = 0.0;
    TANK.turretYaw = 0.0;
    TANK.pitchAngle = 25 * (Math.PI / 180);
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
  const projectionMatrix = mat4.perspective(
    mat4.create(),
    Math.PI / 3.6,
    CANVAS_WIDTH / CANVAS_HEIGHT,
    0.1,
    250.0
  );

  function updateCamera(): void {
    const fwdX = -Math.sin(TANK.yaw);
    const fwdZ = -Math.cos(TANK.yaw);

    if (currentCamera === 0) {
      // Tercera persona siguiendo al tanque
      mat4.lookAt(
        viewMatrix,
        [TANK.x - fwdX * 13.0, 6.5, TANK.z - fwdZ * 13.0],
        [TANK.x + fwdX * 4.0, 2.2, TANK.z + fwdZ * 4.0],
        [0, 1, 0]
      );
    } else if (currentCamera === 1) {
      // Vista cenital (GTA I)
      mat4.lookAt(
        viewMatrix,
        [TANK.x, 32.0, TANK.z],
        [TANK.x, 0.0, TANK.z],
        [0, 0, -1]
      );
    } else {
      // Primera persona desde la punta del cañón
      getMuzzleSpawnAndDirection();
      const eyeX = muzzleWorldPos[0] + cannonDir[0] * 0.25;
      const eyeY = muzzleWorldPos[1] + cannonDir[1] * 0.25;
      const eyeZ = muzzleWorldPos[2] + cannonDir[2] * 0.25;
      mat4.lookAt(
        viewMatrix,
        [eyeX, eyeY, eyeZ],
        [eyeX + cannonDir[0] * 10.0, eyeY + cannonDir[1] * 10.0, eyeZ + cannonDir[2] * 10.0],
        [0, 1, 0]
      );
    }

    ff.setViewMatrix(viewMatrix);
    ff.setProjectionMatrix(projectionMatrix);
  }

  function update(dt: number): void {
    // Rotación de la base del tanque (A/D)
    if (keysPressed['a'] || keysPressed['A']) TANK.yaw += TANK.turnSpeed * dt;
    if (keysPressed['d'] || keysPressed['D']) TANK.yaw -= TANK.turnSpeed * dt;

    // Avance / retroceso en la dirección del tanque (W/S)
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

    // Limitar movimiento al área del suelo
    const maxHalfW = FIELD_WIDTH / 2 - 2.0;
    const maxHalfD = FIELD_DEPTH / 2 - 2.0;
    TANK.x = Math.max(-maxHalfW, Math.min(maxHalfW, TANK.x));
    TANK.z = Math.max(-maxHalfD, Math.min(maxHalfD, TANK.z));

    // Rotación horizontal de la torreta (Flechas Izq/Der)
    if (keysPressed['ArrowLeft']) TANK.turretYaw += TANK.turretSpeed * dt;
    if (keysPressed['ArrowRight']) TANK.turretYaw -= TANK.turretSpeed * dt;

    // Elevación del cañón (Flechas Arr/Abj)
    if (keysPressed['ArrowUp']) TANK.pitchAngle += TANK.pitchSpeed * dt;
    if (keysPressed['ArrowDown']) TANK.pitchAngle -= TANK.pitchSpeed * dt;
    TANK.pitchAngle = Math.max(MIN_PITCH, Math.min(MAX_PITCH, TANK.pitchAngle));

    // Actualizar transformaciones del árbol de escena
    tankBaseNode.position[0] = TANK.x;
    tankBaseNode.position[2] = TANK.z;
    tankBaseNode.rotation[1] = TANK.yaw;

    turretHeadNode.rotation[1] = TANK.turretYaw;
    cannonPivotNode.rotation[0] = TANK.pitchAngle;

    // Actualizar color de las barras de potencia
    for (let b = 0; b < 3; b++) {
      powerBarNodes[b].color = b + 1 <= powerLevel ? [0.2, 0.9, 0.2, 1.0] : [0.0, 0.4, 0.0, 1.0];
    }

    // Ocultar bala en la punta si está volando o si estamos en 1ra persona
    attachedProjectileNode.visible = !PROJECTILE.isFlying && currentCamera !== 2;

    // Actualizar matrices de mundo antes de disparar o mover cámara
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
  }

  const normalMatScratch = mat3.create();
  const identityMat4 = mat4.create();

  function render(): void {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    updateCamera();

    // Dibujar todo el árbol de escena
    sceneRoot.render(gl, ff, normalMatScratch);

    // Previsualización de la trayectoria
    if (!PROJECTILE.isFlying && meshes.trajectory.vertexCount > 1) {
      ff.disable(LIGHTING);
      ff.setColor(COLORS.TRAJECTORY_LINE);
      ff.setModelMatrix(identityMat4);

      gl.bindVertexArray(meshes.trajectory.vao);
      ff.drawArrays(gl.LINE_STRIP, 0, meshes.trajectory.vertexCount);
      ff.enable(LIGHTING);
    }
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