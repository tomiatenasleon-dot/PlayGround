import * as THREE from '../vendor/three.module.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function angleDiff(a, b) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return d;
}
export const dampAngle = (a, b, l, dt) => a + angleDiff(a, b) * (1 - Math.exp(-l * dt));

export function flatDist(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

/* ------------------------------------------------------------------ */
/* textures                                                            */
/* ------------------------------------------------------------------ */
export function noiseTexture({ base = '#1a1d22', specks = ['#0e1014', '#262b33'], size = 256, count = 1400, repeat = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = pick(specks);
    ctx.globalAlpha = rand(0.12, 0.55);
    const r = rand(1, size / 26);
    ctx.beginPath();
    ctx.arc(rand(0, size), rand(0, size), r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,.7)');
  g.addColorStop(0.6, 'rgba(255,255,255,.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

export function makeGlow(color = 0xffaa44, size = 2, opacity = 0.8) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

export function makeBeam(color = 0xffb347, radius = 0.5, height = 14, opacity = 0.3) {
  const geo = new THREE.CylinderGeometry(radius * 0.25, radius, height, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = height / 2;
  return m;
}

export function mesh(geo, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.86, metalness: opts.metalness ?? 0.05,
    flatShading: opts.flat ?? true, emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
  });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = opts.castShadow ?? true;
  m.receiveShadow = opts.receiveShadow ?? true;
  return m;
}

/* ------------------------------------------------------------------ */
/* humanoid rig                                                        */
/* ------------------------------------------------------------------ */
export function buildHumanoid(opts = {}) {
  const {
    coat = 0x28313f, pants = 0x151a22, skin = 0xc99772, height = 1.8,
    hood = false, eyes = null, backpack = false, boots = 0x0f1319,
    scarf = null,
  } = opts;

  const s = height / 1.8;
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.92 * s;
  root.add(hips);

  const coatMat = new THREE.MeshStandardMaterial({ color: coat, roughness: 0.88, flatShading: true });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.95, flatShading: true });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.75, flatShading: true });
  const bootMat = new THREE.MeshStandardMaterial({ color: boots, roughness: 0.8, flatShading: true });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21 * s, 0.4 * s, 4, 8), coatMat);
  torso.position.y = 0.32 * s;
  torso.castShadow = true;
  hips.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.22 * s, 0.26 * s), coatMat);
  chest.position.set(0, 0.48 * s, 0.02 * s);
  chest.castShadow = true;
  hips.add(chest);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055 * s, 0.06 * s, 0.09 * s, 6), skinMat);
  neck.position.y = 0.73 * s;
  hips.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.85 * s;
  hips.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.135 * s, 10, 8), skinMat);
  skull.scale.set(1, 1.12, 0.95);
  skull.castShadow = true;
  head.add(skull);

  if (hood) {
    const hMat = new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 1, flatShading: true });
    const hoodMesh = new THREE.Mesh(new THREE.ConeGeometry(0.23 * s, 0.42 * s, 8), hMat);
    hoodMesh.position.y = 0.03 * s;
    hoodMesh.rotation.x = -0.06;
    head.add(hoodMesh);
    const drape = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.3 * s, 0.36 * s, 8, 1, true), hMat);
    drape.position.y = -0.16 * s;
    head.add(drape);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.14 * s, 8, 6, 0, TAU, 0, Math.PI * 0.62), new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 1, flatShading: true }));
    hair.position.y = 0.035 * s;
    head.add(hair);
  }

  if (eyes) {
    const eMat = new THREE.MeshBasicMaterial({ color: eyes });
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.019 * s, 6, 4), eMat);
      e.position.set(sx * 0.05 * s, 0.015 * s, 0.122 * s);
      head.add(e);
      const glow = makeGlow(eyes, 0.28 * s, 0.9);
      glow.position.copy(e.position);
      head.add(glow);
    }
  }

  if (scarf) {
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.145 * s, 0.045 * s, 5, 10), new THREE.MeshStandardMaterial({ color: scarf, roughness: 1, flatShading: true }));
    sc.position.y = 0.71 * s;
    sc.rotation.x = Math.PI / 2;
    hips.add(sc);
  }

  if (backpack) {
    const bp = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.36 * s, 0.16 * s), new THREE.MeshStandardMaterial({ color: 0x3a3f35, roughness: 1, flatShading: true }));
    bp.position.set(0, 0.36 * s, -0.23 * s);
    bp.castShadow = true;
    hips.add(bp);
  }

  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.29 * s, 0.6 * s, 0);
    hips.add(shoulder);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.072 * s, 0.26 * s, 4, 6), coatMat);
    upper.position.y = -0.16 * s;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.32 * s;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.062 * s, 0.24 * s, 4, 6), coatMat);
    fore.position.y = -0.14 * s;
    fore.castShadow = true;
    elbow.add(fore);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.062 * s, 6, 5), skinMat);
    hand.position.y = -0.3 * s;
    elbow.add(hand);
    return { shoulder, elbow, hand };
  };

  const armL = makeArm(-1);
  const armR = makeArm(1);

  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.115 * s, -0.02 * s, 0);
    hips.add(hip);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.088 * s, 0.3 * s, 4, 6), pantsMat);
    thigh.position.y = -0.2 * s;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.4 * s;
    hip.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.074 * s, 0.3 * s, 4, 6), pantsMat);
    shin.position.y = -0.19 * s;
    shin.castShadow = true;
    knee.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.09 * s, 0.25 * s), bootMat);
    foot.position.set(0, -0.39 * s, 0.05 * s);
    foot.castShadow = true;
    knee.add(foot);
    return { hip, knee };
  };

  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });

  return {
    group: root, hips, torso, head, armL, armR, legL, legR,
    baseHipY: 0.92 * s, scale: s,
    mats: [coatMat, pantsMat, skinMat, bootMat],
  };
}

export function poseHumanoid(rig, t, speed, opts = {}) {
  const { crouch = 0, idle = true, armOverride = null } = opts;
  const amp = clamp(speed / 7, 0, 1.15);
  const p = t * (6.4 + speed * 0.55);
  const s = Math.sin(p), c = Math.cos(p);

  rig.legL.hip.rotation.x = s * 0.72 * amp;
  rig.legR.hip.rotation.x = -s * 0.72 * amp;
  rig.legL.knee.rotation.x = Math.max(0, -Math.sin(p + 0.9)) * 1.0 * amp + crouch * 0.7;
  rig.legR.knee.rotation.x = Math.max(0, -Math.sin(p + 0.9 + Math.PI)) * 1.0 * amp + crouch * 0.7;

  if (!armOverride) {
    rig.armL.shoulder.rotation.x = -s * 0.62 * amp;
    rig.armR.shoulder.rotation.x = s * 0.62 * amp;
    rig.armL.shoulder.rotation.z = -0.12 - amp * 0.04;
    rig.armR.shoulder.rotation.z = 0.12 + amp * 0.04;
    rig.armL.elbow.rotation.x = -0.35 - amp * 0.35;
    rig.armR.elbow.rotation.x = -0.35 - amp * 0.35;
  }

  const bob = Math.abs(s) * 0.055 * amp;
  rig.hips.position.y = rig.baseHipY - crouch * 0.34 + (idle && amp < 0.05 ? Math.sin(t * 1.6) * 0.008 : bob);
  rig.hips.rotation.y = s * 0.07 * amp;
  rig.hips.rotation.z = c * 0.03 * amp;
  rig.head.rotation.y = -s * 0.05 * amp;
}

/* ------------------------------------------------------------------ */
/* effects                                                             */
/* ------------------------------------------------------------------ */
export class FX {
  constructor(scene, count = 260) {
    this.count = count;
    this.pos = new Float32Array(count * 3).fill(-9999);
    this.col = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.maxLife = new Float32Array(count);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.17, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, map: glowTexture(),
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }
  burst(origin, n = 14, color = 0xffb347, spread = 3, up = 2.4, life = 0.7) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.cursor++ % this.count;
      this.pos[k * 3] = origin.x + rand(-0.15, 0.15);
      this.pos[k * 3 + 1] = origin.y + rand(-0.1, 0.25);
      this.pos[k * 3 + 2] = origin.z + rand(-0.15, 0.15);
      const a = rand(0, TAU), sp = rand(0.5, spread);
      this.vel[k * 3] = Math.cos(a) * sp;
      this.vel[k * 3 + 1] = rand(0.4, up);
      this.vel[k * 3 + 2] = Math.sin(a) * sp;
      this.col[k * 3] = c.r; this.col[k * 3 + 1] = c.g; this.col[k * 3 + 2] = c.b;
      this.maxLife[k] = this.life[k] = life * rand(0.6, 1.2);
    }
    this.geo.attributes.color.needsUpdate = true;
  }
  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -9999; continue; }
      this.vel[i * 3 + 1] -= 9 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) { this.pos[i * 3 + 1] = 0.02; this.vel[i * 3 + 1] *= -0.3; this.vel[i * 3] *= 0.7; this.vel[i * 3 + 2] *= 0.7; }
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class Rain {
  constructor(scene, count = 800, opts = {}) {
    this.count = count;
    this.area = opts.area ?? 55;
    this.height = opts.height ?? 26;
    this.speed = opts.speed ?? 34;
    this.wind = opts.wind ?? 4;
    this.positions = new Float32Array(count * 6);
    this.drops = [];
    for (let i = 0; i < count; i++) {
      this.drops.push({ x: rand(-this.area, this.area), y: rand(0, this.height), z: rand(-this.area, this.area), l: rand(0.4, 1.1) });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.mat = new THREE.LineBasicMaterial({
      color: opts.color ?? 0x9fc4e8, transparent: true, opacity: opts.opacity ?? 0.24,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.geo = geo;
    this.center = new THREE.Vector3();
  }
  update(dt, center) {
    this.center.copy(center);
    const p = this.positions;
    for (let i = 0; i < this.count; i++) {
      const d = this.drops[i];
      d.y -= this.speed * dt;
      d.x += this.wind * dt;
      if (d.y < 0) { d.y = this.height; d.x = rand(-this.area, this.area); d.z = rand(-this.area, this.area); }
      if (d.x > this.area) d.x -= this.area * 2;
      const i6 = i * 6;
      p[i6] = center.x + d.x; p[i6 + 1] = d.y; p[i6 + 2] = center.z + d.z;
      p[i6 + 3] = center.x + d.x + this.wind * 0.035; p[i6 + 4] = d.y - d.l; p[i6 + 5] = center.z + d.z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose() {
    this.lines.parent?.remove(this.lines);
    this.geo.dispose();
    this.mat.dispose();
  }
}

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m.map && m.map !== _glowTex) m.map.dispose?.();
        m.dispose?.();
      }
    }
  });
  root.parent?.remove(root);
}
