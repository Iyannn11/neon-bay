// Neon Bay — sky: gradient dome shader, sun + moon discs, stars, soft clouds,
// and the lighting rig that follows the time of day. The sky is the strongest
// visual element of the Top 1 entry, so it gets a real shader dome, not a flat
// colour. Written fresh for Round 12.
import * as THREE from 'three';
import { clamp, lerp } from './random.js';
import { cloudTexture, glowTexture } from './textures.js';

const skyVert = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w; // pin to the far plane
}`;

const skyFrag = `
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 lowColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float sunSize;
uniform float haze;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, -0.08, 1.0);
  vec3 col = mix(lowColor, midColor, smoothstep(0.0, 0.22, h));
  col = mix(col, topColor, smoothstep(0.18, 0.65, h));
  // warm haze band hugging the horizon
  col = mix(col, lowColor, (1.0 - smoothstep(0.0, 0.16, h)) * haze);
  // sun glow + disc
  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 220.0) * 1.4 + pow(s, 18.0) * 0.55 + pow(s, 5.0) * 0.22);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 18),
      new THREE.ShaderMaterial({
        vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide,
        depthWrite: false, fog: false,
        uniforms: {
          topColor: { value: new THREE.Color(0x2a1a4a) },
          midColor: { value: new THREE.Color(0xb34a6e) },
          lowColor: { value: new THREE.Color(0xff8c4a) },
          sunDir: { value: new THREE.Vector3(0, 0.2, -1) },
          sunColor: { value: new THREE.Color(0xffc27a) },
          sunSize: { value: 0.06 },
          haze: { value: 0.7 },
        },
      }),
    );
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // moon disc (visible at night)
    this.moon = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xf4f1de, fog: false, transparent: true, opacity: 0.95 }),
    );
    this.moon.position.set(-420, 430, -700);
    this.moon.lookAt(0, 0, 0);
    scene.add(this.moon);

    // stars
    const starGeo = new THREE.BufferGeometry();
    const N = 700, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.acos(1 - Math.random() * 0.85);
      const r = 850;
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) + 40;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0,
    }));
    scene.add(this.stars);

    // soft clouds: billboarded sprites drifting slowly
    const cloudTex = cloudTexture();
    this.clouds = [];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, opacity: 0.5, fog: false, depthWrite: false,
      }));
      const a = Math.random() * Math.PI * 2, r = 220 + Math.random() * 520;
      m.position.set(Math.cos(a) * r, 150 + Math.random() * 130, Math.sin(a) * r);
      const s = 150 + Math.random() * 190;
      m.scale.set(s, s * 0.45, 1);
      m.userData.drift = 1.5 + Math.random() * 2.5;
      scene.add(m);
      this.clouds.push(m);
    }

    // glow sprite pool for neon (shared by world)
    this.glowTex = glowTexture('#ffffff');

    // lighting rig
    this.sun = new THREE.DirectionalLight(0xffc27a, 1.6);
    this.sun.castShadow = false;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x8a7bd8, 0x1a1410, 0.55);
    scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(this.amb);
    // warm plaza fill so the night cover shot never goes black
    this.fill = new THREE.PointLight(0xff2e88, 60, 120, 1.8);
    this.fill.position.set(0, 18, 0);
    scene.add(this.fill);
    this.fill2 = new THREE.PointLight(0x00e5ff, 40, 110, 1.8);
    this.fill2.position.set(40, 14, -30);
    scene.add(this.fill2);
  }

  // hour: 0..24. 6.5 dawn, 12 noon, 17.5 golden hour, 21.6 night.
  setTime(hour) {
    const u = this.dome.material.uniforms;
    const sunA = ((hour - 6) / 12) * Math.PI; // 6h rise, 18h set
    const elev = Math.sin(sunA);
    const az = Math.cos(sunA);
    const sunDir = new THREE.Vector3(az * 0.7, Math.max(elev, -0.35), -0.7).normalize();
    u.sunDir.value.copy(sunDir);
    const night = hour >= 19 || hour < 5.5;
    const golden = hour >= 16.5 && hour < 19;
    const dawn = hour >= 5.5 && hour < 8;
    if (night) {
      u.topColor.value.set(0x050914); u.midColor.value.set(0x0e1a33); u.lowColor.value.set(0x27324e);
      u.sunColor.value.set(0x8fa8d8); u.haze.value = 0.25;
      this.sun.intensity = 0.25; this.sun.color.set(0x8fa8d8);
      this.sun.position.set(-120, 180, -80);
      this.hemi.intensity = 0.32; this.amb.intensity = 0.42;
      this.stars.material.opacity = 0.9;
      this.moon.material.opacity = 0.95;
      this.fill.intensity = 70; this.fill2.intensity = 50;
      this.scene.fog = new THREE.Fog(0x0a1020, 120, 520);
      for (const c of this.clouds) c.material.opacity = 0.22;
    } else if (golden) {
      u.topColor.value.set(0x2a1a4a); u.midColor.value.set(0xb34a6e); u.lowColor.value.set(0xff8c4a);
      u.sunColor.value.set(0xffc27a); u.haze.value = 0.75;
      this.sun.intensity = 1.9; this.sun.color.set(0xffb36b);
      this.sun.position.copy(sunDir).multiplyScalar(300);
      this.hemi.intensity = 0.6; this.amb.intensity = 0.45;
      this.stars.material.opacity = 0;
      this.moon.material.opacity = 0.12;
      this.fill.intensity = 30; this.fill2.intensity = 20;
      this.scene.fog = new THREE.Fog(0x3a2438, 140, 560);
      for (const c of this.clouds) c.material.opacity = 0.55;
    } else if (dawn) {
      u.topColor.value.set(0x3a4a7a); u.midColor.value.set(0xd87a8a); u.lowColor.value.set(0xffb27a);
      u.sunColor.value.set(0xffd9a0); u.haze.value = 0.6;
      this.sun.intensity = 1.4; this.sun.color.set(0xffc890);
      this.sun.position.copy(sunDir).multiplyScalar(300);
      this.hemi.intensity = 0.55; this.amb.intensity = 0.45;
      this.stars.material.opacity = 0.15;
      this.moon.material.opacity = 0.3;
      this.fill.intensity = 25; this.fill2.intensity = 18;
      this.scene.fog = new THREE.Fog(0x6a4a58, 140, 560);
      for (const c of this.clouds) c.material.opacity = 0.5;
    } else {
      u.topColor.value.set(0x2f7fc4); u.midColor.value.set(0x7fb8dd); u.lowColor.value.set(0xcfe6f2);
      u.sunColor.value.set(0xfff2c8); u.haze.value = 0.35;
      this.sun.intensity = 2.4; this.sun.color.set(0xfff2d8);
      this.sun.position.copy(sunDir).multiplyScalar(300);
      this.hemi.intensity = 0.75; this.amb.intensity = 0.5;
      this.stars.material.opacity = 0;
      this.moon.material.opacity = 0;
      this.fill.intensity = 12; this.fill2.intensity = 10;
      this.scene.fog = new THREE.Fog(0x9fc4d8, 160, 620);
      for (const c of this.clouds) c.material.opacity = 0.6;
    }
    this.sun.target.position.set(0, 0, 0);
  }

  update(dt, t) {
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 800) c.position.x = -800;
    }
    // gentle pulse on the plaza neon fill
    this.fill.intensity = this.fill.intensity * 0.98 + (60 + Math.sin(t * 2.2) * 12) * 0.02;
  }
}

export function timeOfDayName(hour) {
  if (hour >= 19 || hour < 5.5) return 'night';
  if (hour >= 16.5 && hour < 19) return 'golden';
  if (hour >= 5.5 && hour < 8) return 'dawn';
  return 'day';
}
