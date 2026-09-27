"use client";

/* eslint-disable react-hooks/immutability -- R3F frame-loop code intentionally mutates owned Three.js buffers and stable runtime records outside React state. */

import { useFrame, useLoader } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  MathUtils,
  PointsMaterial,
  ShaderMaterial,
  SpriteMaterial,
  Texture,
  TextureLoader,
  SRGBColorSpace,
} from "three";

import { VISUAL_ASSETS } from "@/lib/visuals/assets";
import type {
  ParticleFieldRecord,
  SoulRecord,
} from "@/lib/visuals/VisualRuntime";
import {
  useVisualRevision,
  useVisualRuntime,
} from "@/lib/visuals/VisualRuntimeContext";

const SOUL_TEXTURE_URLS = [
  VISUAL_ASSETS.soul.dormant,
  VISUAL_ASSETS.soul.active,
  VISUAL_ASSETS.soul.charged,
  VISUAL_ASSETS.soul.trail,
  VISUAL_ASSETS.particles,
] as const;

type SharedTextures = Readonly<{
  dormant: Texture;
  active: Texture;
  charged: Texture;
  trail: Texture;
  particles: Texture;
}>;

function seeded(index: number, seed: number): number {
  const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function ParticleField({ record, texture }: Readonly<{
  record: ParticleFieldRecord;
  texture: Texture;
}>) {
  const runtime = useVisualRuntime();
  const materialRef = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    const positions = new Float32Array(record.capacity * 3);
    const velocities = new Float32Array(record.capacity * 3);
    const sizes = new Float32Array(record.capacity);
    for (let index = 0; index < record.capacity; index += 1) {
      const offset = index * 3;
      positions[offset] = (seeded(index * 3, record.seed) - 0.5) * record.spread[0] + record.position[0];
      positions[offset + 1] = (seeded(index * 3 + 1, record.seed) - 0.5) * record.spread[1] + record.position[1];
      positions[offset + 2] = MathUtils.lerp(
        record.depthRange[0],
        record.depthRange[1],
        seeded(index * 3 + 2, record.seed),
      ) + record.position[2];
      const angle = seeded(index + 10, record.seed) * Math.PI * 2;
      const speed = record.velocity * (0.3 + seeded(index + 20, record.seed));
      velocities[offset] = Math.cos(angle) * speed;
      velocities[offset + 1] = Math.sin(angle) * speed;
      velocities[offset + 2] = (seeded(index + 30, record.seed) - 0.5) * speed;
      sizes[index] = MathUtils.lerp(
        record.size[0],
        record.size[1],
        seeded(index + 40, record.seed),
      );
    }
    result.setAttribute("position", new BufferAttribute(positions, 3));
    result.setAttribute("velocity", new BufferAttribute(velocities, 3));
    result.setAttribute("aSize", new BufferAttribute(sizes, 1));
    return result;
  }, [record]);
  const uniforms = useMemo(() => ({
    uMap: { value: texture },
    uColor: { value: new Color(record.color) },
    uOpacity: { value: record.opacity },
  }), [record.color, record.opacity, texture]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_state, delta) => {
    const step = Math.max(1, Math.ceil(record.capacity * delta / 2.5));
    if (record.count < record.targetCount) record.count = Math.min(record.targetCount, record.count + step);
    else if (record.count > record.targetCount) record.count = Math.max(record.targetCount, record.count - step);
    geometry.setDrawRange(0, record.count);
    const positionAttribute = geometry.getAttribute("position") as BufferAttribute;
    const velocityAttribute = geometry.getAttribute("velocity") as BufferAttribute;
    const age = performance.now() / 1000 - record.createdAt;
    const fadeStart = record.lifetime > 0
      ? Math.max(0, record.lifetime - record.fade)
      : Number.POSITIVE_INFINITY;
    if (materialRef.current) {
      materialRef.current.uniforms.uOpacity.value = record.opacity * (
        age > fadeStart
          ? Math.max(0, 1 - (age - fadeStart) / Math.max(0.01, record.fade))
          : 1
      );
    }
    for (let index = 0; index < record.count; index += 1) {
      const px = positionAttribute.getX(index);
      const py = positionAttribute.getY(index);
      const pz = positionAttribute.getZ(index);
      const vx = velocityAttribute.getX(index);
      const vy = velocityAttribute.getY(index);
      const vz = velocityAttribute.getZ(index);
      if (record.mode === "ATTRACT") {
        const strength = Math.min(5, record.attractionStrength * delta);
        positionAttribute.setXYZ(
          index,
          px + (record.attraction[0] - px) * strength,
          py + (record.attraction[1] - py) * strength,
          pz + (record.attraction[2] - pz) * strength,
        );
      } else if (record.mode === "ORBIT") {
        const angle = delta * record.velocity;
        const dx = px - record.position[0];
        const dy = py - record.position[1];
        positionAttribute.setXYZ(
          index,
          record.position[0] + dx * Math.cos(angle) - dy * Math.sin(angle),
          record.position[1] + dx * Math.sin(angle) + dy * Math.cos(angle),
          pz + Math.sin(age + index) * delta * 0.03,
        );
      } else {
        const multiplier = record.mode === "DISSOLVE" ? 1.6 : 1;
        const drift = record.mode === "AMBIENT_DRIFT"
          ? Math.sin(age * 0.7 + index) * record.drift * delta
          : 0;
        positionAttribute.setXYZ(
          index,
          px + vx * delta * multiplier + drift * 0.08,
          py + vy * delta * multiplier + (record.mode === "AMBIENT_DRIFT" ? delta * 0.05 : 0),
          pz + vz * delta * multiplier,
        );
      }
    }
    positionAttribute.needsUpdate = true;
    if (record.lifetime > 0 && age >= record.lifetime) {
      runtime.removeParticleField(record.id);
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={`
          attribute float aSize;
          void main() {
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = max(1.0, aSize * 82.0);
          }
        `}
        fragmentShader={`
          uniform sampler2D uMap;
          uniform vec3 uColor;
          uniform float uOpacity;
          void main() {
            vec4 texel = texture2D(uMap, gl_PointCoord);
            if (texel.a < 0.01) discard;
            gl_FragColor = vec4(texel.rgb * uColor, texel.a * uOpacity);
          }
        `}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}

function SoulTrail({ record, texture }: Readonly<{ record: SoulRecord; texture: Texture }>) {
  const geometryRef = useRef<BufferGeometry>(null);
  const materialRef = useRef<PointsMaterial>(null);
  const buffer = useMemo(() => new Float32Array(64 * 3), []);
  const colors = useMemo(() => {
    const values = new Float32Array(64 * 3);
    for (let index = 0; index < 64; index += 1) {
      const intensity = Math.pow((index + 1) / 64, 1.7);
      values[index * 3] = intensity;
      values[index * 3 + 1] = intensity;
      values[index * 3 + 2] = intensity;
    }
    return values;
  }, []);

  useEffect(() => () => {
    geometryRef.current?.dispose();
    materialRef.current?.dispose();
  }, []);

  useFrame(() => {
    const geometry = geometryRef.current;
    if (!geometry) return;
    const sampleCount = Math.min(64, record.trail.length);
    const sampleStart = record.trail.length - sampleCount;
    for (let index = 0; index < 64; index += 1) {
      const point = record.trail[sampleStart + Math.min(index, Math.max(0, sampleCount - 1))] ?? record.position;
      buffer[index * 3] = point[0];
      buffer[index * 3 + 1] = point[1];
      buffer[index * 3 + 2] = point[2] - 0.01;
    }
    const attribute = geometry.getAttribute("position") as BufferAttribute;
    attribute.needsUpdate = true;
    geometry.setDrawRange(0, sampleCount);
    if (materialRef.current) materialRef.current.opacity = record.trailOpacity;
  });

  return (
    <points frustumCulled={false} renderOrder={record.renderOrder}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[buffer, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        map={texture}
        color="#ffffff"
        size={record.trailWidth}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={AdditiveBlending}
        opacity={0}
        vertexColors
      />
    </points>
  );
}

function SoulObject({ record, textures }: Readonly<{
  record: SoulRecord;
  textures: SharedTextures;
}>) {
  const group = useRef<Group>(null);
  const dormant = useRef<SpriteMaterial>(null);
  const active = useRef<SpriteMaterial>(null);
  const charged = useRef<SpriteMaterial>(null);
  const aura = useRef<SpriteMaterial>(null);

  useFrame(() => {
    if (!group.current) return;
    const now = performance.now() / 1000;
    if (record.flight) {
      const { start, control, end, progress, trail } = record.flight;
      const inverse = 1 - progress;
      record.position[0] = inverse * inverse * start[0] + 2 * inverse * progress * control[0] + progress * progress * end[0];
      record.position[1] = inverse * inverse * start[1] + 2 * inverse * progress * control[1] + progress * progress * end[1];
      record.position[2] = inverse * inverse * start[2] + 2 * inverse * progress * control[2] + progress * progress * end[2];
      if (trail) {
        const last = record.trail.at(-1);
        if (!last || Math.hypot(last[0] - record.position[0], last[1] - record.position[1]) > 0.05) {
          record.trail.push([...record.position]);
          if (record.trail.length > 64) record.trail.shift();
        }
      }
    } else if (record.orbit) {
      const orbit = record.orbit;
      const angle = (now - orbit.startedAt) * orbit.speed + orbit.phase;
      const a = Math.cos(angle) * orbit.radius;
      const b = Math.sin(angle) * orbit.radius;
      if (orbit.plane === "XY") { record.position[0] = orbit.center[0] + a; record.position[1] = orbit.center[1] + b; record.position[2] = orbit.center[2]; }
      if (orbit.plane === "XZ") { record.position[0] = orbit.center[0] + a; record.position[1] = orbit.center[1]; record.position[2] = orbit.center[2] + b; }
      if (orbit.plane === "YZ") { record.position[0] = orbit.center[0]; record.position[1] = orbit.center[1] + a; record.position[2] = orbit.center[2] + b; }
    }
    const breathing = record.breathing
      ? 1 + Math.sin(now * 1.45 + Number(record.id.replace(/\D/g, ""))) * record.breathAmount
      : 1;
    group.current.visible = record.visible;
    group.current.position.set(...record.position);
    group.current.scale.setScalar(record.scale * breathing);
    if (dormant.current) dormant.current.opacity = record.opacity * record.stateWeights.DORMANT;
    if (active.current) {
      active.current.opacity = Math.min(
        1,
        record.opacity * record.stateWeights.ACTIVE * Math.max(0.9, record.glow),
      );
    }
    if (charged.current) charged.current.opacity = record.opacity * record.stateWeights.CHARGED;
    if (aura.current) {
      aura.current.opacity = record.opacity * record.aura * (
        0.28 + Math.sin(now * 1.2) * 0.035
      );
    }
  });

  return (
    <>
      <SoulTrail record={record} texture={textures.trail} />
      <group ref={group} renderOrder={record.renderOrder}>
        <sprite scale={[1.85, 1.85, 1]}>
          <spriteMaterial ref={aura} map={textures.active} color="#de2440" transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} />
        </sprite>
        <sprite scale={[1.35, 1.35, 1]}>
          <spriteMaterial ref={dormant} map={textures.dormant} transparent depthTest={false} depthWrite={false} />
        </sprite>
        <sprite scale={[1.35, 1.35, 1]}>
          <spriteMaterial ref={active} map={textures.active} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} />
        </sprite>
        <sprite scale={[1.48, 1.48, 1]}>
          <spriteMaterial ref={charged} map={textures.charged} transparent depthTest={false} depthWrite={false} blending={AdditiveBlending} />
        </sprite>
      </group>
    </>
  );
}

export function VisualObjects({
  particles = true,
  souls = true,
}: Readonly<{ particles?: boolean; souls?: boolean }> = {}) {
  const runtime = useVisualRuntime();
  useVisualRevision();
  const loaded = useLoader(TextureLoader, [...SOUL_TEXTURE_URLS]);
  const textures = useMemo<SharedTextures>(() => ({
    dormant: loaded[0],
    active: loaded[1],
    charged: loaded[2],
    trail: loaded[3],
    particles: loaded[4],
  }), [loaded]);

  useEffect(() => {
    for (const texture of loaded) {
      texture.colorSpace = SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
    }
    // These textures belong to the shared R3F loader cache and are not disposed per Soul.
  }, [loaded]);

  return (
    <>
      {particles ? [...runtime.particleFields.values()].map((record) => (
        <ParticleField key={record.id} record={record} texture={textures.particles} />
      )) : null}
      {souls ? [...runtime.souls.values()].map((record) => (
        <SoulObject key={record.id} record={record} textures={textures} />
      )) : null}
    </>
  );
}
