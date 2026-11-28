import { mat3, mat4, vec3 } from 'gl-matrix';
import { Color, createFixedFunction, TEXTURE_2D, TEXTURE_UNIT } from './vendor/ff/ff';

export type FF = ReturnType<typeof createFixedFunction>;

export interface GPUMesh {
  vao: WebGLVertexArrayObject;
  indexCount: number;
}

export class SceneNode {
  public position: vec3 = vec3.fromValues(0, 0, 0);
  public rotation: vec3 = vec3.fromValues(0, 0, 0);
  public scale: vec3 = vec3.fromValues(1, 1, 1);

  public localMatrix: mat4 = mat4.create();
  public worldMatrix: mat4 = mat4.create();
  public children: SceneNode[] = [];

  public mesh: GPUMesh | null = null;
  public texture: WebGLTexture | null = null;
  public color: Color = [1, 1, 1, 1];
  public shininess = 20;
  public visible = true;

  public addChild(child: SceneNode): SceneNode {
    this.children.push(child);
    return child;
  }

  public updateLocalMatrix(): void {
    mat4.identity(this.localMatrix);
    mat4.translate(this.localMatrix, this.localMatrix, this.position);
    if (this.rotation[1] !== 0) mat4.rotateY(this.localMatrix, this.localMatrix, this.rotation[1]);
    if (this.rotation[0] !== 0) mat4.rotateX(this.localMatrix, this.localMatrix, this.rotation[0]);
    if (this.rotation[2] !== 0) mat4.rotateZ(this.localMatrix, this.localMatrix, this.rotation[2]);
    mat4.scale(this.localMatrix, this.localMatrix, this.scale);
  }

  public updateWorldMatrix(parentWorldMatrix?: mat4): void {
    this.updateLocalMatrix();
    if (parentWorldMatrix) {
      mat4.multiply(this.worldMatrix, parentWorldMatrix, this.localMatrix);
    } else {
      mat4.copy(this.worldMatrix, this.localMatrix);
    }

    for (const child of this.children) {
      child.updateWorldMatrix(this.worldMatrix);
    }
  }

  public getWorldPosition(out: vec3 = vec3.create()): vec3 {
    return vec3.transformMat4(out, [0, 0, 0], this.worldMatrix);
  }

  public render(gl: WebGL2RenderingContext, ff: FF, normalMatScratch: mat3): void {
    if (!this.visible) return;

    if (this.mesh) {
      if (this.texture) {
        gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        ff.enable(TEXTURE_2D);
      } else {
        ff.disable(TEXTURE_2D);
      }

      // Asignación de color base para modos con y sin iluminación
      ff.setColor(this.color);
      ff.setMaterial({
        ambient: this.color,
        diffuse: this.color,
        specular: [0.3, 0.3, 0.3, 1.0],
        shininess: this.shininess,
      });

      ff.setModelMatrix(this.worldMatrix);
      mat3.normalFromMat4(normalMatScratch, this.worldMatrix);
      ff.setNormalMatrix(normalMatScratch);

      gl.bindVertexArray(this.mesh.vao);
      ff.drawElements(gl.TRIANGLES, this.mesh.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    for (const child of this.children) {
      child.render(gl, ff, normalMatScratch);
    }
  }
}