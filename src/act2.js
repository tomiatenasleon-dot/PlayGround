import * as THREE from '../vendor/three.module.js';
import { clamp, damp, rand, mesh, makeGlow, Rain, disposeObject } from './utils.js';
import { buildCar } from './car.js';

const ROAD_HALF = 6.2;

export class Act2 {
  constructor(game) {
    this.game = game;
    this.fov = 70;
    this.time = 0;
    this.progress = 0;
    this.distance = 940;
    this.speed = 19;
    this.health = 100;
    this.stamina = 100;
    this.damage = 0;
    this.x = 0;
    this.steer = 0;
    this.hitCooldown = 0;
    this.ended = false;
    this.obstacles = [];
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080d14);
    this.scene.fog = new THREE.FogExp2(0x080d14, 0.0085);
    this.scene.add(new THREE.HemisphereLight(0x7890ae, 0x14120f, 0.72));
    const moon = new THREE.DirectionalLight(0x91a9c5, 0.72);
    moon.position.set(-18, 30, -10);
    this.scene.add(moon);
    this._buildRoad();
    this._buildScenery();
    this._buildTraffic();
    this.rain = new Rain(this.scene, 650, { area: 48, height: 24, speed: 36, wind: 3.8, opacity: 0.18 });
    this.cameraTarget = new THREE.Vector3();
    this.game.setBars(this.health, 100, this.stamina, 100);
    this.game.setObjective('No mires atrás', '0 / 940 m');
    this.game.setActionLabel('');
    this.game.audio.setAmbience({ rain: 0.28, wind: 0.58, drone: 0.24, engine: 0.82 });
    this.game.audio.setTension(0.35);
    this.game.audio.setEngine(this.speed, 0.7);
  }

  _buildRoad() {
    const ground = mesh(new THREE.PlaneGeometry(240, 280), 0x18201e, { roughness: 1 });
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.08, 60);
    this.scene.add(ground);
    const road = mesh(new THREE.PlaneGeometry(13, 280), 0x20242a, { roughness: 0.88, metalness: 0.08 });
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, 60);
    this.scene.add(road);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xb9a878, transparent: true, opacity: 0.62 });
    for (const x of [-6.15, 6.15]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 280), edgeMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.012, 60);
      this.scene.add(line);
    }
    this.dashes = [];
    const dashMat = new THREE.MeshBasicMaterial({ color: 0x89909a, transparent: true, opacity: 0.5 });
    for (let lane = -1; lane <= 1; lane += 2) {
      for (let i = 0; i < 16; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 5.2), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lane * 2.15, 0.018, i * 13 + 8);
        this.scene.add(dash);
        this.dashes.push(dash);
      }
    }
    this.car = buildCar({ color: 0x26343e, accent: 0x10151c, headlights: true, brake: true });
    this.car.position.set(0, 0, 0);
    this.scene.add(this.car);
    this.truck = buildCar({ color: 0x322c2c, accent: 0x111216, scale: 1.2, headlights: true, brake: false });
    this.truck.position.set(0, 0, -13);
    this.truck.rotation.y = Math.PI;
    this.scene.add(this.truck);
    for (const x of [-0.62, 0.62]) {
      const lamp = makeGlow(0xff2922, 0.8, 0.65);
      lamp.position.set(x, 0.74, -15.25);
      this.truck.add(lamp);
    }
    this.carLight = new THREE.PointLight(0xe4efff, 1.5, 30, 2);
    this.carLight.position.set(0, 1.4, 2);
    this.car.add(this.carLight);
  }

  _buildScenery() {
    this.posts = [];
    for (let side of [-1, 1]) {
      for (let i = 0; i < 22; i++) {
        const post = new THREE.Group();
        post.position.set(side * (7.4 + rand(0, 0.9)), 0, i * 10 + rand(0, 8));
        const pole = mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.1, 5), 0x53504a, { roughness: 1 });
        pole.position.y = 0.55;
        post.add(pole);
        const reflector = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: side < 0 ? 0xff5436 : 0xe7dcb6 }));
        reflector.position.set(0, 0.84, 0.04);
        post.add(reflector);
        this.scene.add(post);
        this.posts.push(post);
      }
    }
    this.trees = [];
    for (let i = 0; i < 32; i++) {
      const tree = new THREE.Group();
      const side = i % 2 ? 1 : -1;
      tree.position.set(side * rand(12, 24), 0, rand(-20, 200));
      const trunk = mesh(new THREE.CylinderGeometry(0.16, 0.34, rand(3, 5), 6), 0x29251f, { roughness: 1 });
      trunk.position.y = 1.6;
      tree.add(trunk);
      const crown = mesh(new THREE.ConeGeometry(rand(1.3, 2.3), rand(4, 7), 7), 0x17221e, { roughness: 1 });
      crown.position.y = 4.8;
      tree.add(crown);
      this.scene.add(tree);
      this.trees.push(tree);
    }
    this.cityLights = [];
    for (let i = 0; i < 14; i++) {
      const light = new THREE.Group();
      light.position.set((i % 2 ? 1 : -1) * rand(18, 46), rand(3, 13), rand(35, 185));
      const glow = makeGlow(i % 3 ? 0xffb36b : 0x79a9d8, rand(2.2, 4), 0.45);
      light.add(glow);
      this.scene.add(light);
      this.cityLights.push(light);
    }
  }

  _buildTraffic() {
    const lanes = [-3.8, 0, 3.8];
    for (let i = 0; i < 17; i++) {
      const kind = i % 5 === 2 ? 'wreck' : i % 7 === 4 ? 'barrier' : 'debris';
      const group = new THREE.Group();
      const lane = lanes[(i * 7 + 1) % lanes.length];
      group.position.set(lane, 0, 34 + i * 52 + rand(-7, 7));
      if (kind === 'wreck') {
        const body = mesh(new THREE.BoxGeometry(2.3, 0.78, 4.4), 0x423e3a, { roughness: 0.94 });
        body.position.y = 0.58;
        group.add(body);
        const cabin = mesh(new THREE.BoxGeometry(1.72, 0.72, 1.8), 0x171d24, { roughness: 0.42, metalness: 0.35 });
        cabin.position.set(0, 1.28, -0.1);
        group.add(cabin);
        for (const sx of [-0.83, 0.83]) {
          const glow = makeGlow(0xff2e24, 0.72, 0.85);
          glow.position.set(sx, 0.64, -2.22);
          group.add(glow);
        }
      } else if (kind === 'barrier') {
        const bar = mesh(new THREE.BoxGeometry(2.5, 0.85, 0.42), 0x9b442b, { roughness: 0.82 });
        bar.position.y = 0.52;
        group.add(bar);
        for (let n = -1; n <= 1; n++) {
          const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.87, 0.44), new THREE.MeshBasicMaterial({ color: 0xe9d8bd }));
          stripe.position.set(n * 0.75, 0.52, 0.02);
          stripe.rotation.z = -0.45;
          group.add(stripe);
        }
      } else {
        const debris = mesh(new THREE.DodecahedronGeometry(0.72, 0), 0x4b4945, { roughness: 1 });
        debris.position.set(0, 0.45, 0);
        debris.scale.set(1.5, 0.72, 1);
        group.add(debris);
      }
      this.scene.add(group);
      this.obstacles.push({ group, lane, hit: false, kind });
    }
  }

  update(dt) {
    if (this.ended) return;
    this.time += dt;
    const input = this.game.input;
    const steerInput = input.move.x;
    this.steer = damp(this.steer, steerInput, 5.2, dt);
    this.x = clamp(this.x + this.steer * dt * 6.1, -4.55, 4.55);
    const boost = input.sprint && this.stamina > 1;
    this.stamina = boost ? Math.max(0, this.stamina - dt * 24) : Math.min(100, this.stamina + dt * 14);
    const targetSpeed = boost ? 27 : 21.5;
    this.speed = damp(this.speed, targetSpeed, 1.6, dt);
    this.progress += this.speed * dt;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    this.car.position.x = damp(this.car.position.x, this.x, 8, dt);
    this.car.rotation.z = damp(this.car.rotation.z, -this.steer * 0.08, 5, dt);
    this.car.rotation.y = damp(this.car.rotation.y, this.steer * 0.045, 4, dt);
    this.truck.position.x = damp(this.truck.position.x, this.x * 0.65, 1.2, dt);
    this.truck.position.z = -12.5 + Math.sin(this.time * 2.8) * 0.18;
    for (const dash of this.dashes) {
      dash.position.z -= this.speed * dt;
      if (dash.position.z < -14) dash.position.z += 208;
    }
    for (const post of this.posts) {
      post.position.z -= this.speed * dt;
      if (post.position.z < -18) post.position.z += 220;
    }
    for (const tree of this.trees) {
      tree.position.z -= this.speed * dt;
      if (tree.position.z < -35) {
        tree.position.z += 225;
        tree.position.x = (tree.position.x < 0 ? -1 : 1) * rand(12, 24);
      }
    }
    for (const light of this.cityLights) {
      light.position.z -= this.speed * dt;
      if (light.position.z < -28) {
        light.position.z += 220;
        light.position.x = (light.position.x < 0 ? -1 : 1) * rand(18, 46);
      }
    }
    for (const obstacle of this.obstacles) {
      obstacle.group.position.z -= this.speed * dt;
      if (!obstacle.hit && this.hitCooldown <= 0 && obstacle.group.position.z < 1.5 && obstacle.group.position.z > -1.6 && Math.abs(this.x - obstacle.lane) < 1.65) {
        obstacle.hit = true;
        this._crash(obstacle);
      }
      if (obstacle.group.position.z < -22) {
        obstacle.group.position.z += this.obstacles.length * 52;
        obstacle.lane = [-3.8, 0, 3.8][Math.floor(rand(0, 3))];
        obstacle.group.position.x = obstacle.lane;
        obstacle.hit = false;
      }
    }
    this.rain.update(dt, new THREE.Vector3(this.x, 0, 0));
    this.cameraTarget.set(this.x * 0.46, 1.2, 17);
    this.game.camera.position.x = damp(this.game.camera.position.x, this.x * 0.7 - this.steer * 0.35, 4, dt);
    this.game.camera.position.y = damp(this.game.camera.position.y, 5.5, 3, dt);
    this.game.camera.position.z = -10;
    this.game.camera.lookAt(this.cameraTarget);
    this.game.compassTo(null);
    this.game.setBars(this.health, 100, this.stamina, 100);
    this.game.setObjective('Sigue conduciendo', `${Math.min(this.distance, Math.floor(this.progress))} / ${this.distance} m`);
    this.game.audio.setEngine(this.speed, boost ? 1 : 0.72);
    this.game.audio.setTension(clamp(0.38 + this.progress / this.distance * 0.48, 0.3, 0.9));
    this.game.audio.setAmbience({ rain: 0.25, wind: 0.62, drone: 0.25, engine: 0.9 });
    if (this.progress >= this.distance) {
      this.ended = true;
      this.game.audio.setAmbience({ rain: 0.08, wind: 0.12, drone: 0.1, engine: 0.35 });
      this.game.actComplete(2, { time: this.game.actTime, damage: this.damage });
    }
  }

  _crash(obstacle) {
    const damage = obstacle.kind === 'wreck' ? 28 : obstacle.kind === 'barrier' ? 20 : 16;
    this.health = Math.max(0, this.health - damage);
    this.damage += damage;
    this.hitCooldown = 1.25;
    this.speed = Math.max(11, this.speed - 8);
    this.car.rotation.z = rand(-0.2, 0.2);
    this.game.damageFlash();
    this.game.audio.hit();
    this.game.toast('¡Impacto!', `Daño recibido · ${Math.ceil(this.health)}% salud`, 1.25);
    if (this.health <= 0) {
      this.ended = true;
      this.game.playerDied({ cause: 'El camión te empujó fuera de la carretera.', eyebrow: 'Acto II · La carretera', title: 'Te estrellaste' });
    }
  }

  onStart() {}
  onResume() {}
  resize() {}
  dispose() {
    this.rain?.dispose();
    if (this.scene) disposeObject(this.scene);
  }
}
