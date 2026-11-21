// Neon Bay — sky and weather. A full day/night cycle (sun angle, sky colour,
// window glow, street lamps), a golden-hour window at sunset, and rain you can
// toggle with V or in Settings: falling particles, a darker sky and wet,
// shining roads.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, DAY_START } from './config.js';
import { clamp, lerp } from './random.js';

const SKY_DAY = new THREE.Color(0x7ec8f2);
const SKY_SUNSET = new THREE.Color(0xff8a4d);
const SKY_NIGHT = new THREE.Color(0x0b1026);
const SUN_DAY = new THREE.Color(0xfff2d8);
const SUN_SUNSET = new THREE.Color(0xff9a3d);
const SUN_NIGHT = new THREE.Color(0x8aa8ff);

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.time = DAY_START; // 0..1 across the day cycle
    this.rainTarget = 0;
    this.rain01 = 0;
    this.night01 = 0;
    this.golden01 = 0;
    this.autoCycle = true;
    // rain particles: a Points cloud that follows the camera
    const N = 1400;
    this.rainCount = N;
    const pos = new Float32Array(N * 3);
    this.rainVel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = Math.random() * 32;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
      this.rainVel[i] = 24 + Math.random() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xaac8e0, size: 0.14, transparent: true, opacity: 0.0, sizeAttenuation: true });
    this.rain = new THREE.Points(geo, mat);
    this.rain.visible = false;
    this.rain.frustumCulled = false;
    scene.add(this.rain);
    // the sky dome colour is the scene background
    scene.background = new THREE.Color(0x7ec8f2);
    this.sky = scene.background;
    // gradient sky dome: a canvas gradient wrapped on a big backside sphere
    // so the sky has a cinematic zenith-to-horizon falloff instead of one
    // flat colour (sunset reads as a real sunset, night as deep blue)
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 4;
    this.skyCanvas.height = 256;
    this.skyCtx = this.skyCanvas.getContext('2d');
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyTex.colorSpace = THREE.SRGBColorSpace;
    this.skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(700, 24, 16),
      new THREE.MeshBasicMaterial({ map: this.skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    this.skyDome.renderOrder = -1;
    this.skyDome.frustumCulled = false;
    scene.add(this.skyDome);
    this._skyKey = '';
    // a soft fill light rides with the camera so the hero never goes black
    this.fill = new THREE.PointLight(0xfff2e0, 60, 30, 1.6);
    scene.add(this.fill);
    this.fillTarget = new THREE.Object3D();
    scene.add(this.fillTarget);
  }

  setRain(on) {
    this.rainTarget = on ? 1 : 0;
    return this.rainTarget;
  }

  toggleRain() {
    return this.setRain(this.rainTarget < 0.5);
  }

  setTimeOfDay(frac) {
    this.time = ((frac % 1) + 1) % 1;
    this.autoCycle = false;
  }

  // Sun elevation: 0 at midnight, 1 at noon. Sunset sits near time 0.72.
  _sunState() {
    const a = this.time * Math.PI * 2; // 0 = dawn
    const elev = Math.sin(a);          // -1..1
    const night = clamp(1 - (elev + 0.25) * 2.2, 0, 1);
    const golden = clamp(1 - Math.abs(elev - 0.12) * 9, 0, 1) * (1 - night);
    return { elev, night, golden };
  }

  update(dt, camPos, world) {
    if (this.autoCycle) this.time = (this.time + dt / WORLD.dayLength) % 1;
    const { elev, night, golden } = this._sunState();
    this.night01 = night;
    this.golden01 = golden;
    this.rain01 += clamp(this.rainTarget - this.rain01, -dt * 1.5, dt * 1.5);
    const rain = this.rain01;

    // sun position + colour
    const a = this.time * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(a), Math.max(0.06, elev), Math.sin(a) * 0.6).normalize();
    world.sun.position.copy(sunDir).multiplyScalar(220);
    world.sun.position.y = Math.max(30, sunDir.y * 220);
    const sunCol = new THREE.Color().copy(SUN_DAY).lerp(SUN_SUNSET, golden).lerp(SUN_NIGHT, night * 0.7);
    world.sun.color.copy(sunCol);
    world.sun.intensity = lerp(2.6, 0.55, night) * (rain > 0.5 ? 0.45 : 1);
    world.sun.castShadow = true;
    // at golden hour the low sun throws the whole east side into the city's
    // shadow — lift the hemisphere light so shadowed ground still reads
    world.hemi.intensity = lerp(0.95, 0.35, night) * (1 + golden * 0.4);

    // sky
    const skyCol = new THREE.Color().copy(SKY_DAY).lerp(SKY_SUNSET, golden).lerp(SKY_NIGHT, night);
    if (rain > 0.5) skyCol.lerp(new THREE.Color(0x2a3440), 0.55);
    this.sky.copy(skyCol);
    sceneFog(this.scene, night, rain);
    // refresh the dome gradient when the sky state changes
    const skyKey = `${Math.round(this.time * 200)}|${rain > 0.5 ? 1 : 0}`;
    if (skyKey !== this._skyKey) {
      this._skyKey = skyKey;
      const top = skyCol.clone().multiplyScalar(0.45);
      const hor = skyCol.clone().lerp(new THREE.Color(0xffffff), 0.3);
      const g = this.skyCtx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#' + top.getHexString());
      g.addColorStop(0.5, '#' + skyCol.getHexString());
      g.addColorStop(0.64, '#' + hor.getHexString());
      g.addColorStop(1, '#' + hor.getHexString());
      this.skyCtx.fillStyle = g;
      this.skyCtx.fillRect(0, 0, 4, 256);
      this.skyTex.needsUpdate = true;
    }
    this.skyDome.position.copy(camPos);

    // rain particles follow the camera and fall
    this.rain.visible = rain > 0.05;
    if (this.rain.visible) {
      this.rain.material.opacity = rain * 0.75;
      const arr = this.rain.geometry.attributes.position.array;
      for (let i = 0; i < this.rainCount; i++) {
        arr[i * 3 + 1] -= this.rainVel[i] * dt;
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3] = camPos.x + (Math.random() - 0.5) * 70;
          arr[i * 3 + 1] = 26 + Math.random() * 6;
          arr[i * 3 + 2] = camPos.z + (Math.random() - 0.5) * 70;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(0, 0, 0);
    }

    // camera fill light: keeps the hero readable at night
    this.fill.position.set(camPos.x, camPos.y + 2.5, camPos.z);
    this.fill.intensity = lerp(8, 95, night);
    return { night01: night, rain01: rain, golden01: golden };
  }
}

function sceneFog(scene, night, rain) {
  if (!scene.fog) {
    scene.fog = new THREE.Fog(0x7ec8f2, 260, 700);
  }
  const near = rain > 0.5 ? 90 : 260;
  const far = rain > 0.5 ? 380 : 700;
  scene.fog.near = near;
  scene.fog.far = far;
  scene.fog.color.copy(scene.background);
}
