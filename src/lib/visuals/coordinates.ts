import { Raycaster, Vector2, Vector3, type Camera } from "three";

import type { Vec3 } from "./types";

export function screenToNdc(
  x: number,
  y: number,
  width: number,
  height: number,
): Vec3 {
  return [(x / Math.max(1, width)) * 2 - 1, -(y / Math.max(1, height)) * 2 + 1, 0];
}

export function screenToWorld(
  x: number,
  y: number,
  camera: Camera,
  width: number,
  height: number,
  worldZ = 0,
): Vec3 {
  const [ndcX, ndcY] = screenToNdc(x, y, width, height);
  // Raycaster accounts for the materially different ray origins used by
  // orthographic and perspective cameras. Building a direction from
  // camera.position collapses orthographic screen coordinates toward the
  // centre, which is especially visible in the Requiem soul circle.
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
  const { origin, direction } = raycaster.ray;
  if (Math.abs(direction.z) < Number.EPSILON) return [origin.x, origin.y, worldZ];
  const distance = (worldZ - origin.z) / direction.z;
  const world = origin.clone().add(direction.clone().multiplyScalar(distance));
  return [world.x, world.y, world.z];
}

export function worldToScreen(
  position: Vec3,
  camera: Camera,
  width: number,
  height: number,
): readonly [number, number] {
  const projected = new Vector3(...position).project(camera);
  return [((projected.x + 1) / 2) * width, ((1 - projected.y) / 2) * height];
}
