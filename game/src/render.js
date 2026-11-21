// Neon Bay — rendering and the cinematic camera.
//
// One clear job: the WebGL renderer (ACES tone mapping, soft shadows,
// anti-aliasing) and the third-person camera rig — a chase camera with lag,
// a lean into turns, a little shake at speed, and a near/far toggle.

import * as THREE from 'three';
import { clamp, lerp, angleLerp } from './random.js';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  return renderer;
}

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1500);
    this.mode = 0; // 0 far chase, 1 near chase
    this.pos = new THREE.Vector3(0, 12, -30);
    this.look = new THREE.Vector3(0, 2, 0);
    this.shake = 0;
    this._tmp = new THREE.Vector3();
  }

  toggleMode() {
    this.mode = (this.mode + 1) % 2;
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  // Follow a target at (x, z) facing `heading`, moving at `speed`.
  // The camera hangs behind and above, leans into turns, and lags just
  // enough to feel weighty.
  update(dt, x, z, heading, speed, steerLean) {
    const dist = this.mode === 0 ? 13.5 : 8.5;
    const height = this.mode === 0 ? 5.2 : 3.6;
    const backX = x - Math.sin(heading) * dist;
    const backZ = z - Math.cos(heading) * dist;
    const k = 1 - Math.exp(-dt * (this.mode === 0 ? 3.2 : 5.0));
    this.pos.x = lerp(this.pos.x, backX, k);
    this.pos.y = lerp(this.pos.y, height + Math.abs(speed) * 0.02, k);
    this.pos.z = lerp(this.pos.z, backZ, k);
    const lookX = x + Math.sin(heading) * 8;
    const lookZ = z + Math.cos(heading) * 8;
    this.look.x = lerp(this.look.x, lookX, 1 - Math.exp(-dt * 6));
    this.look.y = lerp(this.look.y, 1.8, 1 - Math.exp(-dt * 6));
    this.look.z = lerp(this.look.z, lookZ, 1 - Math.exp(-dt * 6));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * 0.35 * (speed > 20 ? 1 : 0.4);
    const jx = (Math.random() - 0.5) * sh;
    const jy = (Math.random() - 0.5) * sh;
    this.camera.position.set(this.pos.x + jx, this.pos.y + jy, this.pos.z);
    this.camera.lookAt(this.look);
    // Lean into the turn.
    this.camera.rotateZ(-steerLean * 0.045 * clamp(Math.abs(speed) / 14, 0, 1));
  }

  // A slow cinematic orbit for the menu backdrop.
  orbit(dt, time, cx, cz) {
    const a = time * 0.05;
    const r = 90;
    this.camera.position.set(cx + Math.cos(a) * r, 34, cz + Math.sin(a) * r);
    this.camera.lookAt(cx, 6, cz);
  }
}
