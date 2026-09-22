import { Vector3, type Camera } from "three";

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
  const projected = new Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const direction = projected.sub(camera.position).normalize();
  const distance = (worldZ - camera.position.z) / direction.z;
  const world = camera.position.clone().add(direction.multiplyScalar(distance));
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

