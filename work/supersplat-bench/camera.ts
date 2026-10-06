import * as THREE from 'three';

export type CameraSpec = {
  id?: number; img_name?: string; position: number[]; rotation: number[][];
  fx: number; fy: number; width: number; height: number;
};

/** Graphdeco cameras.json stores OpenCV camera-to-world rotation and position. */
export function applyCamera(camera: THREE.PerspectiveCamera, spec: CameraSpec, width: number, height: number) {
  if (![spec.fx,spec.fy,spec.width,spec.height].every(x=>Number.isFinite(x)&&x>0)) throw new Error('Invalid camera intrinsics');
  const r=spec.rotation,p=spec.position;
  // Convert camera axes: OpenCV +X right,+Y down,+Z forward -> Three +X right,+Y up,-Z forward.
  camera.matrix.set(r[0][0],-r[0][1],-r[0][2],p[0],r[1][0],-r[1][1],-r[1][2],p[1],r[2][0],-r[2][1],-r[2][2],p[2],0,0,0,1);
  camera.matrix.decompose(camera.position,camera.quaternion,camera.scale);
  camera.matrixAutoUpdate=true;
  camera.near=0.01;camera.far=1000;
  // Independently scale original intrinsics to a fixed framebuffer. The same transform is used by both renderers.
  camera.aspect=width/height;
  camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(spec.height/(2*spec.fy)));
  const near=camera.near,far=camera.far;
  const ax=2*spec.fx/spec.width, ay=2*spec.fy/spec.height;
  camera.projectionMatrix.set(ax,0,0,0,0,ay,0,0,0,0,-(far+near)/(far-near),-2*far*near/(far-near),0,0,-1,0);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld(true);
  return camera;
}
