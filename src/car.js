import * as THREE from '../vendor/three.module.js';
import { makeGlow } from './utils.js';

/** Low-poly car facing +Z (headlights at +Z). */
export function buildCar({
  color = 0x8e1f22, accent = 0x14181f, scale = 1,
  headlights = true, brake = true, spoiler = false,
} = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.55, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7, metalness: 0.35, flatShading: true });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1016, roughness: 0.15, metalness: 0.9, flatShading: true });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 1, flatShading: true });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.25, metalness: 0.95 });

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.46, 4.15), bodyMat);
  chassis.position.y = 0.66;
  chassis.castShadow = true;
  g.add(chassis);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.18, 1.35), bodyMat);
  hood.position.set(0, 0.95, 1.32);
  hood.castShadow = true;
  g.add(hood);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.58, 1.95), bodyMat);
  cabin.position.set(0, 1.13, -0.28);
  cabin.castShadow = true;
  g.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.1, 1.7), bodyMat);
  roof.position.set(0, 1.44, -0.3);
  g.add(roof);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.08), glassMat);
  windshield.position.set(0, 1.14, 0.72);
  windshield.rotation.x = -0.34;
  g.add(windshield);
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.46, 0.08), glassMat);
  rearGlass.position.set(0, 1.14, -1.27);
  rearGlass.rotation.x = 0.3;
  g.add(rearGlass);
  for (const s of [-1, 1]) {
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 1.5), glassMat);
    sideGlass.position.set(s * 0.83, 1.18, -0.3);
    g.add(sideGlass);
  }

  // bumpers
  for (const z of [2.08, -2.08]) {
    const bump = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.2, 0.16), darkMat);
    bump.position.set(0, 0.56, z);
    g.add(bump);
  }

  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 12);
  const rimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.28, 8);
  for (const sx of [-1, 1]) {
    for (const sz of [1, -1]) {
      const w = new THREE.Mesh(wheelGeo, tireMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * 0.94, 0.38, sz * 1.35);
      w.castShadow = true;
      g.add(w);
      const rim = new THREE.Mesh(rimGeo, chromeMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(w.position);
      g.add(rim);
    }
  }

  if (spoiler) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.35), darkMat);
    sp.position.set(0, 1.35, -1.95);
    g.add(sp);
    for (const s of [-1, 1]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.12), darkMat);
      st.position.set(s * 0.7, 1.2, -1.95);
      g.add(st);
    }
  }

  if (headlights) {
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff2cf }));
      hl.position.set(s * 0.62, 0.74, 2.1);
      g.add(hl);
      const glow = makeGlow(0xffe9b0, 1.5, 0.85);
      glow.position.set(s * 0.62, 0.74, 2.18);
      g.add(glow);
    }
    const spot = new THREE.SpotLight(0xffe4b0, 90, 55, 0.5, 0.55, 1.4);
    spot.position.set(0, 0.9, 2.0);
    spot.target.position.set(0, 0.1, 26);
    g.add(spot, spot.target);
    g.userData.headlight = spot;
  }

  if (brake) {
    for (const s of [-1, 1]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.13, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      tl.position.set(s * 0.66, 0.8, -2.1);
      g.add(tl);
      const glow = makeGlow(0xff2211, 0.9, 0.6);
      glow.position.set(s * 0.66, 0.8, -2.16);
      g.add(glow);
    }
  }

  // grille
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.06), chromeMat);
  grille.position.set(0, 0.62, 2.12);
  g.add(grille);

  g.scale.setScalar(scale);
  return g;
}
