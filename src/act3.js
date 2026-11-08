import * as THREE from '../vendor/three.module.js';
import {
  TAU, clamp, damp, dampAngle, rand, mesh, makeGlow,
  buildHumanoid, poseHumanoid, FX, Rain, disposeObject,
} from './utils.js';

const ARENA_X = 9.2;
const ARENA_Z = 10.5;

export class Act3 {
  constructor(game) {
    this.game = game;
    this.fov = 64;
    this.time = 0;
    this.health = 100;
    this.stamina = 100;
    this.damage = 0;
    this.bossHealth = 180;
    this.bossMax = 180;
    this.bossDamageFlash = 0;
    this.playerInvuln = 0;
    this.dodgeTime = 0;
    this.dodgeCooldown = 0;
    this.staminaDelay = 0;
    this.attackCooldown = 0;
    this.attackTime = 0;
    this.hitStop = 0;
    this.shake = 0;
    this.ended = false;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080c13);
    this.scene.fog = new THREE.FogExp2(0x080c13, 0.027);
    this.scene.add(new THREE.HemisphereLight(0x879db9, 0x171719, 0.72));
    const moon = new THREE.DirectionalLight(0x9caec6, 1.15);
    moon.position.set(-8, 18, 7);
    this.scene.add(moon);
    const red = new THREE.PointLight(0xb72322, 38, 22, 2);
    red.position.set(0, 5, -8);
    this.scene.add(red);
    const amber = new THREE.PointLight(0xff9b49, 25, 16, 2);
    amber.position.set(8, 4, 5);
    this.scene.add(amber);
    this._buildRoof();
    this._buildSetDressing();
    this._buildFighter();
    this.rain = new Rain(this.scene, 520, { area: 32, height: 22, speed: 35, wind: 3.2, opacity: 0.2 });
    this.fx = new FX(this.scene, 180);
    this.cameraYaw = 0;
    this.cameraTarget = new THREE.Vector3();
    this.game.setBars(this.health, 100, this.stamina, 100);
    this.game.setObjective('Acaba con el Segador', 'Golpea y esquiva sus embestidas');
    this.game.setActionLabel('Golpear');
    this.game.hideCompass();
    this.game.setBossPips(0);
    this.game.audio.setAmbience({ rain: 0.36, wind: 0.3, drone: 0.45, engine: 0 });
    this.game.audio.setTension(0.82);
  }

  _buildRoof() {
    const floor = mesh(new THREE.BoxGeometry(24, 0.55, 27), 0x303238, { roughness: 0.96 });
    floor.position.y = -0.3;
    this.scene.add(floor);
    const roofTop = mesh(new THREE.PlaneGeometry(22.8, 25.8), 0x373a3d, { roughness: 0.95 });
    roofTop.rotation.x = -Math.PI / 2;
    roofTop.position.y = -0.012;
    this.scene.add(roofTop);
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x62615c, transparent: true, opacity: 0.3 });
    for (let x = -10; x <= 10; x += 2) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 25), seamMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.012, 0);
      this.scene.add(line);
    }
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a4b4d, roughness: 0.9 });
    for (const [x, z, w, d] of [[0, -13.1, 24, 0.4], [0, 13.1, 24, 0.4], [-11.8, 0, 0.4, 26], [11.8, 0, 0.4, 26]]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), trimMat);
      curb.position.set(x, 0.1, z);
      curb.castShadow = true;
      this.scene.add(curb);
    }
    // Wet rooftop patches catch the city light without obscuring the combat floor.
    for (let i = 0; i < 13; i++) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(rand(0.3, 1.05), 12), new THREE.MeshStandardMaterial({
        color: 0x687078, roughness: 0.2, metalness: 0.28, transparent: true, opacity: 0.25,
      }));
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.y = rand(0.35, 0.8);
      puddle.position.set(rand(-10, 10), 0.02, rand(-11, 11));
      this.scene.add(puddle);
    }
  }

  _buildSetDressing() {
    const dark = 0x24272b;
    // Rooftop access room and its failing emergency light.
    const hut = mesh(new THREE.BoxGeometry(5.2, 3.6, 3.7), 0x343338, { roughness: 1 });
    hut.position.set(-7.3, 1.8, -9.3);
    this.scene.add(hut);
    const door = mesh(new THREE.BoxGeometry(1.25, 2.45, 0.08), 0x17191d, { roughness: 1 });
    door.position.set(-7.3, 1.22, -7.4);
    this.scene.add(door);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.08), new THREE.MeshBasicMaterial({ color: 0xe84b36 }));
    sign.position.set(-7.3, 2.8, -7.35);
    this.scene.add(sign);
    const glow = makeGlow(0xff3d2e, 3.2, 0.72);
    glow.position.set(-7.3, 3.2, -7.1);
    this.scene.add(glow);
    // Vents, ducts and warning-painted equipment around the arena perimeter.
    for (const [x, z, sx, sz] of [[7.8, -8.7, 2.4, 1.5], [8, 7.7, 2.1, 1.4], [-8, 7.8, 2, 1.2], [3.8, -10.7, 2.4, 1]]) {
      const unit = new THREE.Group();
      unit.position.set(x, 0, z);
      const base = mesh(new THREE.BoxGeometry(sx, 0.72, sz), dark, { roughness: 0.86 });
      base.position.y = 0.36;
      unit.add(base);
      const cap = mesh(new THREE.BoxGeometry(sx * 0.85, 0.12, sz * 0.82), 0x515254, { roughness: 0.72, metalness: 0.22 });
      cap.position.y = 0.78;
      unit.add(cap);
      for (let i = 0; i < 4; i++) {
        const slat = mesh(new THREE.BoxGeometry(sx * 0.76, 0.035, 0.055), 0x85817a, { roughness: 0.8 });
        slat.position.set(0, 0.82, -sz * 0.3 + i * sz * 0.2);
        unit.add(slat);
      }
      this.scene.add(unit);
    }
    // Skyline silhouettes beyond the parapet.
    for (let i = 0; i < 24; i++) {
      const h = rand(7, 24), w = rand(3, 7);
      const tower = mesh(new THREE.BoxGeometry(w, h, rand(3, 7)), i % 3 ? 0x111720 : 0x17181d, { roughness: 1 });
      const side = i % 2 ? 1 : -1;
      tower.position.set(side * rand(18, 42), h / 2 - 1, rand(-35, 32));
      this.scene.add(tower);
      if (i % 3 === 0) {
        for (let j = 0; j < 3; j++) {
          const window = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.03), new THREE.MeshBasicMaterial({ color: j % 2 ? 0xffb35d : 0x7196c2 }));
          window.position.set(tower.position.x + (j - 1) * 0.65, rand(1, h - 1), tower.position.z + w / 2 + 0.02);
          this.scene.add(window);
        }
      }
    }
    // A red rotating beacon makes the roof legible in the storm.
    this.beacon = new THREE.Group();
    this.beacon.position.set(0, 0, -12.7);
    const post = mesh(new THREE.CylinderGeometry(0.07, 0.12, 2.7, 6), 0x292a2d, { roughness: 0.9 });
    post.position.y = 1.35;
    this.beacon.add(post);
    const lamp = new THREE.PointLight(0xff3028, 13, 11, 2);
    lamp.position.y = 2.8;
    this.beacon.add(lamp);
    const beaconGlow = makeGlow(0xff2821, 1.6, 0.75);
    beaconGlow.position.y = 2.8;
    this.beacon.add(beaconGlow);
    this.scene.add(this.beacon);
  }

  _buildFighter() {
    const playerRig = buildHumanoid({ coat: 0x34434a, pants: 0x20262c, skin: 0xc99772, height: 1.78, backpack: true, scarf: 0xb64c35 });
    this.player = { rig: playerRig, pos: new THREE.Vector3(0, 0, 7.2), yaw: Math.PI, speed: 0 };
    this.scene.add(playerRig.group);
    const killerRig = buildHumanoid({ coat: 0x17191d, pants: 0x111317, skin: 0x474044, height: 2.08, hood: true, eyes: 0xff241b, boots: 0x090b0e });
    this.boss = {
      rig: killerRig, pos: new THREE.Vector3(0, 0, -1.6), yaw: 0,
      state: 'approach', stateTime: 0, cooldown: 1.8, speed: 1.65,
      attackSide: 0, health: this.bossHealth, flash: 0,
    };
    this.scene.add(killerRig.group);
    this.bossAura = new THREE.PointLight(0xd51b1b, 3, 5, 2);
    this.bossAura.position.set(0, 1.6, 0);
    killerRig.group.add(this.bossAura);
    this.threatRing = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.84, 28), new THREE.MeshBasicMaterial({
      color: 0xff2e24, transparent: true, opacity: 0.72, side: THREE.DoubleSide,
    }));
    this.threatRing.rotation.x = -Math.PI / 2;
    this.threatRing.position.y = 0.035;
    this.threatRing.visible = false;
    this.scene.add(this.threatRing);
    this.playerRing = new THREE.Mesh(new THREE.RingGeometry(0.58, 0.66, 24), new THREE.MeshBasicMaterial({
      color: 0xffb85d, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    }));
    this.playerRing.rotation.x = -Math.PI / 2;
    this.playerRing.position.y = 0.025;
    this.scene.add(this.playerRing);
  }

  update(dt) {
    if (this.ended) return;
    this.time += dt;
    const input = this.game.input;
    this.playerInvuln = Math.max(0, this.playerInvuln - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.dodgeTime = Math.max(0, this.dodgeTime - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackTime = Math.max(0, this.attackTime - dt);
    this.staminaDelay = Math.max(0, this.staminaDelay - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.boss.flash = Math.max(0, this.boss.flash - dt);
    this.boss.cooldown = Math.max(0, this.boss.cooldown - dt);
    this.boss.stateTime += dt;
    this.game.input.look && (this.cameraYaw -= input.look.x);
    this.cameraYaw = THREE.MathUtils.euclideanModulo(this.cameraYaw + Math.PI, TAU) - Math.PI;

    this._updatePlayer(dt, input);
    this._updateBoss(dt);
    this._updateCombat(input);
    this._updateEffects(dt);
    this._updateCamera(dt);
    this._updateHud();
    this.game.audio.setTension(clamp(0.68 + (1 - this.boss.health / this.bossMax) * 0.26, 0.65, 0.98));
    this.game.audio.setAmbience({ rain: 0.34, wind: 0.29, drone: 0.46, engine: 0 });
  }

  _updatePlayer(dt, input) {
    const p = this.player;
    const mx = input.move.x, my = input.move.y;
    const rightX = Math.cos(this.cameraYaw), rightZ = Math.sin(this.cameraYaw);
    const forwardX = Math.sin(this.cameraYaw), forwardZ = -Math.cos(this.cameraYaw);
    let dx = rightX * mx - forwardX * my;
    let dz = rightZ * mx - forwardZ * my;
    const len = Math.hypot(dx, dz);
    if (len > 1) { dx /= len; dz /= len; }
    const moving = len > 0.08;

    if (input.dodgePressed() && this.dodgeCooldown <= 0 && this.stamina >= 18) {
      if (!moving) {
        dx = -Math.sin(p.yaw);
        dz = -Math.cos(p.yaw);
      }
      const dlen = Math.hypot(dx, dz) || 1;
      p.dodgeX = dx / dlen;
      p.dodgeZ = dz / dlen;
      this.dodgeTime = 0.34;
      this.dodgeCooldown = 0.82;
      this.playerInvuln = 0.48;
      this.stamina = Math.max(0, this.stamina - 18);
      this.staminaDelay = 0.65;
      this.game.audio.dodge();
    }

    let speed = input.sprint && this.stamina > 1 ? 5.2 : 3.35;
    if (input.sprint && moving && this.dodgeTime <= 0) {
      this.stamina = Math.max(0, this.stamina - 15 * dt);
      this.staminaDelay = 0.55;
    } else if (this.staminaDelay <= 0) this.stamina = Math.min(100, this.stamina + 22 * dt);
    if (this.attackTime > 0) speed *= 0.52;
    if (this.dodgeTime > 0) {
      const burst = 11 * dt;
      p.pos.x += p.dodgeX * burst;
      p.pos.z += p.dodgeZ * burst;
      p.speed = 8;
    } else {
      p.pos.x += dx * speed * dt;
      p.pos.z += dz * speed * dt;
      p.speed = moving ? speed : 0;
    }
    p.pos.x = clamp(p.pos.x, -ARENA_X, ARENA_X);
    p.pos.z = clamp(p.pos.z, -ARENA_Z, ARENA_Z);
    if (moving && this.dodgeTime <= 0) p.yaw = dampAngle(p.yaw, Math.atan2(dx, dz), 12, dt);
    else if (this.dodgeTime <= 0) p.yaw = dampAngle(p.yaw, Math.atan2(this.boss.pos.x - p.pos.x, this.boss.pos.z - p.pos.z), 5, dt);

    poseHumanoid(p.rig, this.time, p.speed, { idle: true });
    if (this.dodgeTime > 0) {
      p.rig.hips.rotation.z = Math.sin(this.time * 38) * 0.22;
      p.rig.hips.rotation.x = 0.18;
    }
  }

  _updateBoss(dt) {
    const b = this.boss, p = this.player;
    const dx = p.pos.x - b.pos.x, dz = p.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    const targetYaw = Math.atan2(dx, dz);
    b.yaw = dampAngle(b.yaw, targetYaw, b.state === 'windup' || b.state === 'strike' ? 8 : 3.6, dt);
    b.rig.group.position.copy(b.pos);
    b.rig.group.rotation.y = b.yaw;

    if (b.state === 'approach') {
      b.speed = damp(b.speed, dist > 2.15 ? (this.bossHealth < 95 ? 2.2 : 1.65) : 0, 3, dt);
      if (dist > 1.85) {
        b.pos.x += Math.sin(b.yaw) * b.speed * dt;
        b.pos.z += Math.cos(b.yaw) * b.speed * dt;
      }
      if (dist < 2.7 && b.cooldown <= 0) {
        b.state = 'windup';
        b.stateTime = 0;
        b.attackSide = Math.random() < 0.5 ? -1 : 1;
        b.speed = 0;
      }
    } else if (b.state === 'windup') {
      b.speed = 0;
      if (b.stateTime > 0.82) {
        b.state = 'strike';
        b.stateTime = 0;
        b.pos.x += Math.sin(b.yaw) * 0.75;
        b.pos.z += Math.cos(b.yaw) * 0.75;
        this.game.audio.swing();
      }
    } else if (b.state === 'strike') {
      if (b.stateTime > 0.22) {
        const nowDist = Math.hypot(p.pos.x - b.pos.x, p.pos.z - b.pos.z);
        const facing = Math.cos(b.yaw) * (p.pos.z - b.pos.z) + Math.sin(b.yaw) * (p.pos.x - b.pos.x);
        if (nowDist < 2.35 && facing > -0.15 && this.playerInvuln <= 0) this._hurtPlayer(24);
        b.state = 'recover';
        b.stateTime = 0;
        b.cooldown = this.bossHealth < 70 ? 1.25 : 1.65;
      }
    } else if (b.state === 'recover') {
      if (b.stateTime > 0.78) {
        b.state = 'approach';
        b.stateTime = 0;
      }
    } else if (b.state === 'stunned') {
      if (b.stateTime > 0.58) {
        b.state = 'approach';
        b.stateTime = 0;
      }
    }

    b.pos.x = clamp(b.pos.x, -ARENA_X + 0.5, ARENA_X - 0.5);
    b.pos.z = clamp(b.pos.z, -ARENA_Z + 0.5, ARENA_Z - 0.5);
    b.rig.group.position.copy(b.pos);
    b.rig.group.rotation.y = b.yaw;
    b.rig.group.scale.setScalar(b.flash > 0 ? 1.055 : 1);
    b.bob = b.state === 'windup' ? Math.sin(b.stateTime * 19) * 0.09 : 0;
    b.rig.hips.position.y = b.rig.baseHipY + b.bob;
    const guarding = b.state === 'windup' || b.state === 'strike';
    b.rig.armL.shoulder.rotation.x = guarding ? -1.15 : -0.16;
    b.rig.armR.shoulder.rotation.x = guarding ? -1.15 : -0.16;
    b.rig.armL.shoulder.rotation.z = -0.18;
    b.rig.armR.shoulder.rotation.z = 0.18;
    b.rig.armL.elbow.rotation.x = guarding ? -0.85 : -0.25;
    b.rig.armR.elbow.rotation.x = guarding ? -0.85 : -0.25;
    this.bossAura.intensity = guarding ? 6 + Math.sin(this.time * 24) * 3 : 2.4;
    this.threatRing.visible = guarding;
    this.threatRing.position.set(b.pos.x, 0.04, b.pos.z);
    this.threatRing.scale.setScalar(guarding ? 1 + Math.max(0, b.stateTime) * 0.18 : 1);
  }

  _updateCombat(input) {
    const p = this.player, b = this.boss;
    if (!input.attackPressed() || this.attackCooldown > 0 || this.dodgeTime > 0) return;
    this.attackCooldown = 0.48;
    this.attackTime = 0.3;
    this.game.audio.swing();
    const dx = b.pos.x - p.pos.x, dz = b.pos.z - p.pos.z;
    const dist = Math.hypot(dx, dz);
    const facing = Math.cos(p.yaw) * dz + Math.sin(p.yaw) * dx;
    if (dist < 2.45 && facing > 0.2 && b.state !== 'strike' && b.state !== 'recover' && b.state !== 'stunned') {
      const damage = 18 + (this.stamina > 70 ? 4 : 0);
      b.health = Math.max(0, b.health - damage);
      this.bossHealth = b.health;
      b.flash = 0.16;
      b.state = 'stunned';
      b.stateTime = 0;
      b.cooldown = Math.max(b.cooldown, 0.35);
      this.hitStop = 0.045;
      this.shake = 0.16;
      const hitAt = new THREE.Vector3(b.pos.x, 1.1, b.pos.z);
      this.fx.burst(hitAt, 18, 0xff6a43, 3.2, 2.8, 0.55);
      this.game.audio.hitFlesh();
      this.game.toast('¡Le diste!', b.health > 0 ? 'Aprovecha cuando baje la guardia' : 'El Segador ha caído', 0.9);
      if (b.health <= 0) this._win();
    }
  }

  _hurtPlayer(amount) {
    this.health = Math.max(0, this.health - amount);
    this.damage += amount;
    this.playerInvuln = 0.8;
    this.shake = 0.32;
    this.game.damageFlash();
    this.game.audio.hurt();
    this.fx.burst(new THREE.Vector3(this.player.pos.x, 1.1, this.player.pos.z), 12, 0xc83535, 2.4, 2, 0.42);
    this.game.toast('¡Te alcanzó!', `Salud · ${Math.ceil(this.health)}%`, 1.2);
    if (this.health <= 0) {
      this.ended = true;
      this.game.playerDied({ cause: 'El Segador te derribó en la azotea.', eyebrow: 'Acto III · Cuerpo a cuerpo', title: 'No lograste escapar' });
    }
  }

  _updateEffects(dt) {
    this.rain.update(dt, this.player.pos);
    this.fx.update(dt);
    this.beacon.rotation.y += dt * 1.8;
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - dt);
    if (this.shake > 0) {
      this.game.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.game.camera.position.y += (Math.random() - 0.5) * this.shake * 0.55;
    }
    if (this.playerInvuln > 0) this.player.rig.group.visible = Math.floor(this.time * 24) % 2 === 0;
    else this.player.rig.group.visible = true;
  }

  _updateCamera(dt) {
    const p = this.player.pos;
    this.cameraTarget.set(p.x, 1.05, p.z - 0.3);
    const distance = 7.1;
    const x = p.x + Math.sin(this.cameraYaw) * distance;
    const z = p.z + Math.cos(this.cameraYaw) * distance;
    this.game.camera.position.x = damp(this.game.camera.position.x, x, 5, dt);
    this.game.camera.position.y = damp(this.game.camera.position.y, 4.15, 5, dt);
    this.game.camera.position.z = damp(this.game.camera.position.z, z, 5, dt);
    this.game.camera.lookAt(this.cameraTarget);
  }

  _updateHud() {
    this.game.setBars(this.health, 100, this.stamina, 100);
    const phase = this.boss.health <= 0 ? 3 : this.boss.health <= 60 ? 2 : this.boss.health <= 120 ? 1 : 0;
    this.game.bossBar(this.boss.health, this.bossMax, phase);
    const dist = Math.round(Math.hypot(this.player.pos.x - this.boss.pos.x, this.player.pos.z - this.boss.pos.z));
    this.game.setObjective('Acaba con el Segador', dist > 2.4 ? `Distancia · ${dist} m` : '¡Ahora, golpea!');
  }

  _win() {
    if (this.ended) return;
    this.ended = true;
    this.boss.rig.group.rotation.z = 1.2;
    this.game.audio.roar();
    this.game.hideBossBar();
    this.game.setActionLabel('');
    this.game.actComplete(3, { time: this.game.actTime, damage: this.damage });
  }

  onStart() {}
  onResume() {}
  resize() {}
  dispose() {
    this.rain?.dispose();
    if (this.scene) disposeObject(this.scene);
  }
}
