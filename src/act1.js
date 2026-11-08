import * as THREE from '../vendor/three.module.js';
import {
  TAU, clamp, damp, dampAngle, rand, pick, mesh, makeGlow, makeBeam,
  noiseTexture, buildHumanoid, poseHumanoid, FX, Rain, disposeObject, angleDiff, flatDist,
} from './utils.js';
import { buildCar } from './car.js';

const BOUND = 88;

function segAABB(x1, z1, x2, z2, b) {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dz = z2 - z1;
  if (Math.abs(dx) < 1e-6) {
    if (x1 < b.minX || x1 > b.maxX) return false;
  } else {
    let ta = (b.minX - x1) / dx, tb = (b.maxX - x1) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-6) {
    if (z1 < b.minZ || z1 > b.maxZ) return false;
  } else {
    let ta = (b.minZ - z1) / dz, tb = (b.maxZ - z1) / dz;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return t1 > 0.015 && t0 < 0.985;
}

export class Act1 {
  constructor(game) {
    this.game = game;
    this.fov = 62;
    this.time = 0;
    this.phase = 'intro';
    this.damageTaken = 0;
    this.colliders = [];
    this.fuels = [];
    this.collected = 0;
    this.ended = false;
    this.shake = 0;
    this.thunderT = rand(9, 16);
    this.flashT = 0;
    this.staminaDelay = 0;
    this.hurtTimer = 0;
    this.huntTimer = 0;
    this.dodgeCD = 0;
    this.dodgeT = 0;
    this.dodgeDir = new THREE.Vector3();
    this.invuln = 0;
    this.stepT = 0;
    this.alerted = false;

    this._buildScene();
    this._buildWorld();
    this._buildPlayer();
    this._buildKiller();
    this._buildFuels();
    this._buildCar();

    this.camYaw = Math.PI / 2;
    this.camPitch = 0.24;
    this.camDist = 6.2;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this._updateCamera(0.016, true);
    game.audio.setAmbience({ rain: 0.5, wind: 0.36, drone: 0.3, engine: 0 });
    game.audio.setTension(0.1);
    game.setBars(100, 100, 100, 100);
    game.setObjective('Recoge el combustible', '0 / 3 bidones');
    game.setActionLabel('');
  }

  /* ---------------------------------------------------------------- */
  _buildScene() {
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(0x070b12);
    s.fog = new THREE.FogExp2(0x070b12, 0.0165);

    const hemi = new THREE.HemisphereLight(0x44577a, 0x0a0c0b, 0.62);
    s.add(hemi);
    this.hemi = hemi;

    const moon = new THREE.DirectionalLight(0xa8c0e8, 0.85);
    moon.position.set(-36, 52, -28);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -46;
    moon.shadow.camera.right = 46;
    moon.shadow.camera.top = 46;
    moon.shadow.camera.bottom = -46;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 150;
    moon.shadow.bias = -0.0012;
    s.add(moon);
    s.add(moon.target);
    this.moon = moon;

    // sky dome with gradient
    const skyGeo = new THREE.SphereGeometry(400, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: new THREE.Color(0x05080f) }, bottom: { value: new THREE.Color(0x131c2b) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.25,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
    });
    s.add(new THREE.Mesh(skyGeo, skyMat));

    this.rain = new Rain(s, 900, { area: 46, height: 28, speed: 38, wind: 5, opacity: 0.22 });
    this.fx = new FX(s, 240);
  }

  _addCollider(x, z, w, d, h = 6) {
    this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: 0, maxY: h });
  }

  _buildWorld() {
    const s = this.scene;

    // ground
    const groundTex = noiseTexture({
      base: '#1e221d', specks: ['#151a15', '#2a2e24', '#30342a', '#101410'], size: 256, count: 2200, repeat: 26,
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300, 1, 1),
      new THREE.MeshStandardMaterial({ map: groundTex, color: 0x9aa08c, roughness: 0.82, metalness: 0.12 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);

    // roads
    const asphalt = noiseTexture({ base: '#191b1e', specks: ['#101214', '#23262a', '#2c2f33'], size: 256, count: 1800, repeat: 18 });
    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, color: 0xbfc4c8, roughness: 0.5, metalness: 0.25 });
    const main = new THREE.Mesh(new THREE.PlaneGeometry(190, 9), roadMat);
    main.rotation.x = -Math.PI / 2;
    main.position.y = 0.015;
    main.receiveShadow = true;
    s.add(main);
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(8, 150), roadMat);
    cross.rotation.x = -Math.PI / 2;
    cross.position.set(-4, 0.014, 0);
    cross.receiveShadow = true;
    s.add(cross);

    // road markings
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xb9b394, transparent: true, opacity: 0.32 });
    for (let x = -92; x < 92; x += 8) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.22), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.02, 0);
      s.add(dash);
    }

    this._buildHouses();
    this._buildLamps();
    this._buildTrees();
    this._buildProps();
  }

  _buildHouses() {
    const specs = [
      [-64, 14, 9, 7, 4.3, 0x2c2a26, 0x2a1715, true],
      [-62, -15, 8, 7, 4.7, 0x262b2c, 0x201a17, false],
      [-43, 16, 10, 8, 5.0, 0x31281f, 0x2b1614, true],
      [-40, -17, 7, 6, 3.9, 0x24282a, 0x1c1714, false],
      [-22, 12, 8, 6, 4.5, 0x2a2c29, 0x2a1715, true],
      [-18, -15, 9, 7, 4.1, 0x2e2723, 0x211916, false],
      [1, 17, 10, 8, 5.3, 0x2b2d2b, 0x301a16, true],
      [3, -18, 8, 7, 4.3, 0x272a2b, 0x1f1916, true],
      [23, 14, 7, 6, 3.7, 0x312b24, 0x241a16, false],
      [25, -16, 10, 8, 4.9, 0x2a2b28, 0x2c1714, true],
      [46, 15, 8, 7, 4.3, 0x2c2823, 0x221a16, false],
      [45, -14, 7, 6, 3.9, 0x272c2e, 0x1d1815, true],
      [66, 17, 9, 7, 4.5, 0x2e2a25, 0x291714, false],
      [68, -15, 8, 6, 4.1, 0x282a27, 0x1f1916, true],
    ];
    for (const [x, z, w, d, h, wall, roof, lit] of specs) {
      this._house(x, z, w, d, h, wall, roof, lit);
      this._addCollider(x, z, w + 0.4, d + 0.4, h);
    }

    // barn near the escape car
    const barn = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a2b20, roughness: 0.95, flatShading: true });
    const bw = 14, bd = 11, bh = 5.4;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wallMat);
    body.position.y = bh / 2;
    body.castShadow = body.receiveShadow = true;
    barn.add(body);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x241612, roughness: 1, flatShading: true });
    for (const s of [-1, 1]) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(bw + 1.2, 0.3, 7.4), roofMat);
      slab.position.set(0, bh + 1.5, s * 3.1);
      slab.rotation.x = s * 0.52;
      slab.castShadow = true;
      barn.add(slab);
    }
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x17110d, roughness: 1 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 0.2), doorMat);
    door.position.set(0, 1.8, -bd / 2 - 0.02);
    barn.add(door);
    const barnLight = new THREE.PointLight(0xffa04d, 24, 22, 2);
    barnLight.position.set(0, 3.2, -bd / 2 + 1.2);
    barn.add(barnLight);
    const glow = makeGlow(0xff9c4a, 5, 0.3);
    glow.position.set(0, 3.0, -bd / 2 + 0.4);
    barn.add(glow);
    barn.position.set(84, 0, 26);
    barn.rotation.y = 0.08;
    this.scene.add(barn);
    this._addCollider(84, 26, bw, bd, bh);
  }

  _house(x, z, w, d, h, wall, roof, lit) {
    const g = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: wall, roughness: 0.95, flatShading: true });
    const roofMat = new THREE.MeshStandardMaterial({ color: roof, roughness: 1, flatShading: true });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = body.receiveShadow = true;
    g.add(body);

    const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) * 0.63, h * 0.5, 4), roofMat);
    roofMesh.position.y = h + h * 0.25;
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
    roofMesh.castShadow = true;
    g.add(roofMesh);

    const winMatLit = new THREE.MeshStandardMaterial({ color: 0x2a1a0c, emissive: 0xffa64d, emissiveIntensity: 1.9, roughness: 0.6 });
    const winMatDark = new THREE.MeshStandardMaterial({ color: 0x0c1116, roughness: 0.3, metalness: 0.6 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x14100d, roughness: 1 });
    const addWindow = (px, py, pz, ry) => {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.4, 0.1), frameMat);
      fr.position.set(px, py, pz);
      fr.rotation.y = ry;
      g.add(fr);
      const wm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.12, 0.12), lit ? winMatLit : winMatDark);
      wm.position.set(px, py, pz);
      wm.rotation.y = ry;
      g.add(wm);
      if (lit) {
        const gl = makeGlow(0xffa851, 2.4, 0.24);
        gl.position.set(px + Math.sin(ry) * 0.12, py, pz + Math.cos(ry) * 0.12);
        g.add(gl);
      }
    };
    const fy = h * 0.58;
    addWindow(-w * 0.24, fy, d / 2 + 0.02, 0);
    addWindow(w * 0.24, fy, d / 2 + 0.02, 0);
    if (w > 8) {
      addWindow(-w * 0.24, fy, -d / 2 - 0.02, Math.PI);
      addWindow(w * 0.24, fy, -d / 2 - 0.02, Math.PI);
    }
    addWindow(w / 2 + 0.02, fy, 0, Math.PI / 2);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x16110c, roughness: 1 }));
    door.position.set(0, 1.05, d / 2 + 0.03);
    g.add(door);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.7), new THREE.MeshStandardMaterial({ color: 0x2f2c26, roughness: 1 }));
    step.position.set(0, 0.09, d / 2 + 0.35);
    step.receiveShadow = true;
    g.add(step);

    if (lit) {
      const lamp = new THREE.PointLight(0xffa552, 7, 11, 2);
      lamp.position.set(0, 2.6, d / 2 + 0.8);
      g.add(lamp);
    }

    g.position.set(x, 0, z);
    g.rotation.y = rand(-0.045, 0.045);
    this.scene.add(g);
  }

  _buildLamps() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.7, metalness: 0.5 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a2115, emissive: 0xffb066, emissiveIntensity: 2.6 });
    const xs = [-72, -44, -14, 16, 48, 74];
    xs.forEach((x, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const z = side * 6.2;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.4, 6), poleMat);
      pole.position.y = 2.7;
      pole.castShadow = true;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.09), poleMat);
      arm.position.set(-side * 0.6, 5.32, 0);
      g.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.34), lampMat);
      head.position.set(-side * 1.15, 5.24, 0);
      g.add(head);
      const gl = makeGlow(0xffb066, 3.2, 0.55);
      gl.position.copy(head.position);
      g.add(gl);
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.6, 5.1, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.05, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      cone.position.set(-side * 1.15, 2.6, 0);
      g.add(cone);
      if (i % 2 === 0) {
        const pl = new THREE.PointLight(0xffb066, 26, 20, 2);
        pl.position.copy(head.position);
        g.add(pl);
      }
      g.position.set(x, 0, z);
      this.scene.add(g);
    });
  }

  _buildTrees() {
    const count = 210;
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.4, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x191410, roughness: 1, flatShading: true });
    const leafGeo = new THREE.ConeGeometry(1.5, 4.4, 6);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x0f1a15, roughness: 1, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count);
    trunks.castShadow = leaves.castShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      let x, z;
      if (i < 150) {
        const a = rand(0, TAU), r = rand(78, 135);
        x = Math.cos(a) * r; z = Math.sin(a) * r;
      } else {
        const a = rand(0, TAU), r = rand(34, 76);
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        if (Math.abs(z) < 22) { x = pick([-1, 1]) * rand(30, 80); z = pick([-1, 1]) * rand(26, 60); }
      }
      const s = rand(0.8, 1.6);
      p.set(x, 1.2 * s, z);
      sc.set(s, s, s);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU));
      m.compose(p, q, sc);
      trunks.setMatrixAt(i, m);
      p.set(x, 3.3 * s, z);
      m.compose(p, q, sc);
      leaves.setMatrixAt(i, m);
    }
    this.scene.add(trunks, leaves);
  }

  _buildProps() {
    // bushes
    const bushGeo = new THREE.SphereGeometry(1, 7, 5);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x15231a, roughness: 1, flatShading: true });
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, 70);
    bushes.castShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU), r = rand(16, 82);
      p.set(Math.cos(a) * r, rand(0.3, 0.55), Math.sin(a) * r);
      if (Math.abs(p.z) < 8) p.z += 14;
      sc.set(rand(0.7, 1.6), rand(0.5, 1.0), rand(0.7, 1.6));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, TAU));
      m.compose(p, q, sc);
      bushes.setMatrixAt(i, m);
    }
    this.scene.add(bushes);

    // fire barrels
    this._barrel(-30, 7.5);
    this._barrel(56, -7.2);

    // fountain in the square
    const g = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: 0x3a3b36, roughness: 0.95, flatShading: true });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 0.7, 10), stone);
    base.position.y = 0.35;
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x0d1b22, roughness: 0.1, metalness: 0.8 }));
    water.position.y = 0.68;
    g.add(water);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 2.2, 8), stone);
    col.position.y = 1.5;
    col.castShadow = true;
    g.add(col);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.4, 0.35, 10), stone);
    bowl.position.y = 2.5;
    g.add(bowl);
    g.position.set(-8, 0, 24);
    this.scene.add(g);
    this._addCollider(-8, 24, 5.4, 5.4, 2.5);

    // crates near houses
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x3a2c1d, roughness: 1, flatShading: true });
    const spots = [[-52, 9], [-35, 11], [12, 10], [38, -9], [60, 9], [70, -9]];
    for (const [x, z] of spots) {
      for (let i = 0; i < 2; i++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), crateMat);
        c.position.set(x + rand(-0.8, 0.8), 0.45 + i * 0.9, z + rand(-0.8, 0.8));
        c.rotation.y = rand(0, TAU);
        c.castShadow = c.receiveShadow = true;
        this.scene.add(c);
      }
    }

    // low stone walls along the road edge in places
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2e2f2a, roughness: 1, flatShading: true });
    for (const x of [-58, -6, 34, 62]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 0.5), wallMat);
      w.position.set(x, 0.4, -8.5);
      w.castShadow = w.receiveShadow = true;
      this.scene.add(w);
      this._addCollider(x, -8.5, 9, 0.5, 0.8);
    }

    // distant town silhouettes + red emergency glow
    const farMat = new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 1 });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU), r = rand(110, 165);
      const h = rand(6, 22);
      const b = new THREE.Mesh(new THREE.BoxGeometry(rand(5, 13), h, rand(5, 13)), farMat);
      b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      this.scene.add(b);
    }
    const fireGlow = new THREE.PointLight(0xff3a1a, 120, 90, 2);
    fireGlow.position.set(-40, 8, 70);
    this.scene.add(fireGlow);
    const fg = makeGlow(0xff3a1a, 42, 0.22);
    fg.position.copy(fireGlow.position);
    this.scene.add(fg);
    this.fireGlow = fireGlow;
  }

  _barrel(x, z) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.05, 8), new THREE.MeshStandardMaterial({ color: 0x35251a, roughness: 0.9, metalness: 0.4, flatShading: true }));
    b.position.y = 0.52;
    b.castShadow = true;
    g.add(b);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xffa63d, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    fire.position.y = 1.3;
    g.add(fire);
    const light = new THREE.PointLight(0xff7a26, 16, 15, 2);
    light.position.y = 1.5;
    g.add(light);
    const glow = makeGlow(0xff8a33, 3.4, 0.5);
    glow.position.y = 1.25;
    g.add(glow);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.barrels = this.barrels || [];
    this.barrels.push({ fire, light, seed: rand(0, 10) });
    this._addCollider(x, z, 0.9, 0.9, 1.1);
  }
}

Act1.prototype._buildPlayer = function () {
  const rig = buildHumanoid({ coat: 0x2f4a52, pants: 0x1a2028, skin: 0xc99772, height: 1.78, backpack: true, scarf: 0xcf5a35 });
  const g = rig.group;
  g.position.set(-80, 0, 4);
  this.scene.add(g);
  this.rig = rig;
  this.player = {
    pos: g.position, vel: new THREE.Vector3(), yaw: Math.PI / 2,
    hp: 100, hpMax: 100, stam: 100, stamMax: 100, crouch: 0,
    knock: new THREE.Vector3(), speed: 0, alive: true,
  };

  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.14), new THREE.MeshBasicMaterial({ color: 0xfff2cc }));
  lamp.position.set(0.2, 1.42, 0.2);
  g.add(lamp);
  const flash = new THREE.SpotLight(0xffe6bd, 55, 34, 0.46, 0.55, 1.3);
  flash.position.set(0.2, 1.42, 0.2);
  flash.target.position.set(0, 0.6, 12);
  g.add(flash, flash.target);
  this.flash = flash;
};

Act1.prototype._buildKiller = function () {
  const rig = buildHumanoid({
    coat: 0x0d1014, pants: 0x080a0d, skin: 0x7d736b, height: 2.08,
    hood: true, eyes: 0xff2b1b, boots: 0x050607,
  });
  const g = rig.group;
  g.position.set(-52, 0, -30);
  this.scene.add(g);
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.92, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x9aa2aa, roughness: 0.32, metalness: 0.85, flatShading: true }),
  );
  blade.position.set(0, -0.72, 0.12);
  blade.rotation.x = 0.18;
  rig.armR.elbow.add(blade);
  const rim = makeGlow(0xff2a12, 2.6, 0.3);
  rim.position.y = 1.3;
  g.add(rim);
  const light = new THREE.PointLight(0xff2a12, 4.5, 7, 2);
  light.position.y = 1.8;
  g.add(light);

  this.killer = {
    rig, group: g, pos: g.position, yaw: 0, speed: 0,
    state: 'patrol', target: new THREE.Vector3(-52, 0, -30),
    patrol: [new THREE.Vector3(-52, 0, -30), new THREE.Vector3(-20, 0, 34), new THREE.Vector3(30, 0, 30), new THREE.Vector3(58, 0, -30), new THREE.Vector3(6, 0, -34)],
    patrolI: 0, loseT: 0, windup: 0, recover: 0, lungeCD: 0, lungeT: 0,
    alertGlow: rim, alertLight: light, lastSeen: new THREE.Vector3(), seen: false,
  };
  g.rotation.y = Math.PI / 2;
};

Act1.prototype._buildFuels = function () {
  const spots = [
    [-58, 27], [16, 31], [46, -25],
  ];
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.5, metalness: 0.55, flatShading: true, emissive: 0x4a3305, emissiveIntensity: 0.7 });
  for (const [x, z] of spots) {
    const g = new THREE.Group();
    const can = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.28), mat);
    can.position.y = 0.4;
    can.castShadow = true;
    g.add(can);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 6), mat);
    cap.position.set(0.1, 0.76, 0);
    g.add(cap);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 5, 8), mat);
    handle.rotation.y = Math.PI / 2;
    handle.position.set(-0.12, 0.72, 0);
    g.add(handle);
    const beam = makeBeam(0xffc857, 0.5, 9, 0.16);
    g.add(beam);
    const glow = makeGlow(0xffc857, 2.6, 0.6);
    glow.position.y = 0.7;
    g.add(glow);
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.fuels.push({ group: g, pos: new THREE.Vector3(x, 0, z), taken: false, seed: rand(0, 10) });
  }
};

Act1.prototype._buildCar = function () {
  const car = buildCar({ color: 0x6e1b1b, headlights: true });
  car.position.set(82, 0, 2);
  car.rotation.y = Math.PI / 2;
  this.scene.add(car);
  this.car = car;
  const beam = makeBeam(0xffb347, 0.8, 16, 0.14);
  beam.position.set(82, 0, 2);
  this.scene.add(beam);
  this.carBeam = beam;
  this._addCollider(82, 2, 5, 3, 1.6);
};

Act1.prototype._updateCamera = function (dt, snap = false) {
  const p = this.player.pos;
  const desired = new THREE.Vector3(
    p.x - Math.sin(this.camYaw) * this.camDist,
    p.y + 3.1 + this.camPitch * 3,
    p.z - Math.cos(this.camYaw) * this.camDist,
  );
  this.camPos.lerp(desired, snap ? 1 : 1 - Math.exp(-7 * dt));
  this.camLook.set(p.x, p.y + 1.25, p.z);
  this.game.camera.position.copy(this.camPos);
  this.game.camera.lookAt(this.camLook);
};

Act1.prototype._moveWithCollision = function (obj, dx, dz, radius = 0.42) {
  const ox = obj.x, oz = obj.z;
  let nx = clamp(ox + dx, -BOUND, BOUND), nz = clamp(oz + dz, -BOUND, BOUND);
  for (const b of this.colliders) {
    if (nx + radius > b.minX && nx - radius < b.maxX && nz + radius > b.minZ && nz - radius < b.maxZ) {
      if (!(ox + radius > b.minX && ox - radius < b.maxX && oz + radius > b.minZ && oz - radius < b.maxZ)) {
        if (ox + radius <= b.minX || ox - radius >= b.maxX) nx = ox;
        if (oz + radius <= b.minZ || oz - radius >= b.maxZ) nz = oz;
      } else { nx = ox; nz = oz; }
    }
  }
  obj.x = nx; obj.z = nz;
};

Act1.prototype._hurt = function (amount) {
  if (this.invuln > 0 || !this.player.alive) return;
  this.player.hp = Math.max(0, this.player.hp - amount);
  this.damageTaken += amount;
  this.invuln = 1.15;
  this.hurtTimer = 0.45;
  this.shake = 0.34;
  this.game.damageFlash();
  this.game.audio.hit();
  this.player.knock.set(this.player.pos.x - this.killer.pos.x, 0, this.player.pos.z - this.killer.pos.z).normalize().multiplyScalar(5.5);
  if (this.player.hp <= 0) {
    this.player.alive = false;
    this.game.playerDied({ cause: 'El Segador te alcanzó antes de llegar al coche.', eyebrow: 'Acto I · La huida', title: 'Te encontró' });
  }
};

Act1.prototype._attack = function () {
  if (this.dodgeT > 0 || this.dodgeCD > 0 || this.player.stam < 24) return;
  this.player.stam -= 24;
  this.dodgeCD = 0.72;
  this.dodgeT = 0.28;
  const i = this.game.input;
  const forward = new THREE.Vector3(Math.sin(this.player.yaw), 0, Math.cos(this.player.yaw));
  const side = new THREE.Vector3(forward.z, 0, -forward.x);
  this.dodgeDir.copy(forward).multiplyScalar(-i.move.y || 1).addScaledVector(side, i.move.x).normalize();
  if (this.dodgeDir.lengthSq() < 0.1) this.dodgeDir.copy(forward);
  this.invuln = Math.max(this.invuln, 0.38);
  this.game.audio.dodge?.();
};

Act1.prototype._updateKiller = function (dt) {
  const k = this.killer, p = this.player.pos;
  const dist = flatDist(k.pos, p);
  const sees = dist < 27 && (dist < 10 || Math.random() > 0.003);
  if (sees) {
    k.state = 'chase'; k.loseT = 0;
    if (!k.seen) { k.seen = true; this.game.toast('Te ha visto', '¡Corre!'); this.alerted = true; }
    k.target.copy(p);
  } else if (k.state === 'chase') {
    k.loseT += dt;
    if (k.loseT > 4.5) { k.state = 'patrol'; k.seen = false; }
  }
  if (k.state === 'patrol') {
    const waypoint = k.patrol[k.patrolI];
    if (flatDist(k.pos, waypoint) < 2.4) k.patrolI = (k.patrolI + 1) % k.patrol.length;
    k.target.copy(k.patrol[k.patrolI]);
  }
  const dx = k.target.x - k.pos.x, dz = k.target.z - k.pos.z;
  const desiredYaw = Math.atan2(dx, dz);
  k.yaw = dampAngle(k.yaw, desiredYaw, 4.5, dt);
  k.group.rotation.y = k.yaw;
  const speed = k.state === 'chase' ? 4.35 : 1.55;
  k.speed = damp(k.speed, speed, 2.4, dt);
  if (dist > 1.65) this._moveWithCollision(k.pos, Math.sin(k.yaw) * k.speed * dt, Math.cos(k.yaw) * k.speed * dt, 0.4);
  poseHumanoid(k.rig, this.time, k.speed, { idle: false });
  k.alertGlow.material.opacity = k.state === 'chase' ? 0.8 : 0.25;
  k.alertLight.intensity = k.state === 'chase' ? 6 : 2;
  k.lungeCD = Math.max(0, k.lungeCD - dt);
  if (dist < 1.8 && k.lungeCD <= 0) {
    k.lungeCD = 1.35;
    this._hurt(18);
  }
};

Act1.prototype.update = function (dt) {
  if (this.ended) return;
  this.time += dt;
  this.invuln = Math.max(0, this.invuln - dt);
  this.dodgeCD = Math.max(0, this.dodgeCD - dt);
  this.dodgeT = Math.max(0, this.dodgeT - dt);
  this.staminaDelay = Math.max(0, this.staminaDelay - dt);
  this.shake = Math.max(0, this.shake - dt);
  this.rain.update(dt, this.player.pos);
  this.fx.update(dt);
  this.game.input.look && (this.camYaw -= this.game.input.look.x);
  this.camPitch = clamp(this.camPitch - this.game.input.look.y, -0.08, 0.68);
  this.camYaw = dampAngle(this.camYaw, this.player.yaw, 0.22, dt);
  const input = this.game.input;
  const p = this.player;
  if (input.dodgePressed()) this._attack();
  const forward = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const wish = forward.multiplyScalar(-input.move.y).addScaledVector(right, input.move.x);
  const moving = wish.lengthSq() > 0.01;
  if (moving) wish.normalize();
  const sprint = input.sprint && p.stam > 2 && moving && !input.crouch;
  const speed = input.crouch ? 1.65 : sprint ? 6.2 : 3.35;
  if (moving && this.dodgeT <= 0) {
    p.yaw = dampAngle(p.yaw, Math.atan2(wish.x, wish.z), 10, dt);
    this._moveWithCollision(p.pos, wish.x * speed * dt, wish.z * speed * dt);
  }
  if (this.dodgeT > 0) this._moveWithCollision(p.pos, this.dodgeDir.x * 10 * dt, this.dodgeDir.z * 10 * dt);
  if (p.knock.lengthSq() > 0.01) {
    this._moveWithCollision(p.pos, p.knock.x * dt, p.knock.z * dt);
    p.knock.multiplyScalar(Math.exp(-7 * dt));
  }
  if (sprint) { p.stam = Math.max(0, p.stam - 22 * dt); this.staminaDelay = 1.1; }
  else if (this.staminaDelay <= 0) p.stam = Math.min(100, p.stam + 19 * dt);
  p.speed = moving ? speed : 0;
  poseHumanoid(this.rig, this.time, p.speed, { crouch: input.crouch ? 0.72 : 0 });
  this._updateKiller(dt);

  let nearbyFuel = null;
  for (const f of this.fuels) {
    f.group.rotation.y += dt * 0.65;
    f.group.position.y = Math.sin(this.time * 2 + f.seed) * 0.08;
    if (!f.taken && flatDist(p.pos, f.pos) < 2.1) nearbyFuel = f;
  }
  const nearCar = flatDist(p.pos, this.car.position) < 4.2;
  if (nearbyFuel) {
    this.game.prompt('E · Recoger combustible');
    if (input.interactPressed()) {
      nearbyFuel.taken = true;
      this.collected++;
      this.scene.remove(nearbyFuel.group);
      this.game.audio.pickup();
      this.game.toast('Combustible encontrado', `${this.collected} / 3 bidones`);
      this.game.setObjective('Llega al coche', `${this.collected} / 3 bidones`);
    }
  } else if (nearCar) {
    if (this.collected >= 3) {
      this.game.prompt('E · Escapar en el coche');
      if (input.interactPressed()) {
        this.ended = true;
        this.game.audio.setAmbience({ rain: 0.1, wind: 0.12, drone: 0.1, engine: 0.8 });
        this.game.actComplete(1, { time: this.game.actTime, damage: this.damageTaken });
      }
    } else {
      this.game.prompt('Faltan bidones de combustible');
    }
  } else this.game.prompt('');

  const target = this.collected < 3 ? this.fuels.find((f) => !f.taken)?.pos : this.car.position;
  this.game.compassTo(target, this.camPos, this.camYaw);
  this.game.setBars(p.hp, p.hpMax, p.stam, p.stamMax);
  this._updateCamera(dt);
  this.game.camera.position.x += (Math.random() - 0.5) * this.shake;
  this.game.audio.setTension(this.killer.state === 'chase' ? clamp(1 - flatDist(p.pos, this.killer.pos) / 22, 0.12, 0.95) : 0.08);
  this.game.audio.setAmbience({ rain: 0.48, wind: 0.34, drone: 0.32, engine: 0 });
};

Act1.prototype.onStart = function () {};
Act1.prototype.onResume = function () {};
Act1.prototype.resize = function () {};
Act1.prototype.dispose = function () {
  this.rain?.dispose();
  if (this.scene) disposeObject(this.scene);
};
