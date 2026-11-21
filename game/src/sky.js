// Neon Bay — sky dome, sun, moon, stars and clouds. The sky is never a
// flat colour: a gradient dome, a visible sun with haze, soft drifting
// clouds, and stars + moon at night.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const VERT = `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
varying vec3 vPos;
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
void main() {
  float h = normalize(vPos).y;
  float t = clamp(h * 0.9 + 0.12, 0.0, 1.0);
  vec3 col = mix(horizonColor, topColor, pow(t, 0.8));
  float s = max(dot(normalize(vPos), normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 220.0) * 1.4 + pow(s, 10.0) * 0.42);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      topColor: { value: new THREE.Color(0x2f7fd0) },
      horizonColor: { value: new THREE.Color(0xbfdcff) },
      sunDir: { value: new THREE.Vector3(0.4, 0.55, 0.3).normalize() },
      sunColor: { value: new THREE.Color(0xfff3c4) },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(700, 24, 16),
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    dome.name = 'skyDome';
    scene.add(dome);
    this.dome = dome;

    // Sun disc with a soft glow sprite around it.
    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff6cf, fog: false }),
    );
    this.sunDisc.name = 'sunDisc';
    scene.add(this.sunDisc);

    // Moon: pale disc, only visible at night.
    this.moon = new THREE.Mesh(
      new THREE.CircleGeometry(16, 32),
      new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false, transparent: true, opacity: 0 }),
    );
    this.moon.position.set(-260, 300, -420);
    this.moon.lookAt(0, 0, 0);
    this.moon.name = 'moon';
    scene.add(this.moon);

    // Stars: points scattered over the upper dome, faded in at night.
    const starCount = 700;
    const pos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI * 0.45 + 0.08;
      const r = 660;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false,
    }));
    this.stars.name = 'stars';
    scene.add(this.stars);

    // Clouds: clusters of soft flattened spheres, drifting slowly.
    // Big and soft so they read as sky, not paper cutouts.
    this.clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, fog: false });
    const cloudMatNight = new THREE.MeshBasicMaterial({ color: 0x8d9bb8, transparent: true, opacity: 0.25, fog: false });
    for (let i = 0; i < 14; i++) {
      const group = new THREE.Group();
      const puffs = 4 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(18 + Math.random() * 16, 10, 8), cloudMat);
        s.position.set((p - puffs / 2) * 22, Math.random() * 4, Math.random() * 12 - 6);
        s.scale.y = 0.32;
        group.add(s);
      }
      group.position.set(Math.random() * 900 - 450, 130 + Math.random() * 50, Math.random() * 900 - 450);
      group.userData = { speed: 1.2 + Math.random() * 1.6, mat: cloudMat, nightMat: cloudMatNight };
      scene.add(group);
      this.clouds.push(group);
    }

    this.timeOfDay = 'day';
    this.sunLight = null;
    this.hemi = null;
    this.setTime('day');
  }

  attachLights(sunLight, hemi) {
    this.sunLight = sunLight;
    this.hemi = hemi;
  }

  // t: 'day' | 'golden' | 'night' — lerp the whole atmosphere.
  setTime(t) {
    this.timeOfDay = t;
    const p = CONFIG.times[t];
    this.uniforms.topColor.value.setHex(p.top);
    this.uniforms.horizonColor.value.setHex(p.horizon);
    this.uniforms.sunColor.value.setHex(p.sun);
    this.scene.fog = new THREE.Fog(p.fog, CONFIG.fogNear, CONFIG.fogFar);
    this.scene.background = new THREE.Color(p.fog);
    if (this.sunLight) {
      this.sunLight.intensity = p.sunI;
      this.sunLight.color.setHex(t === 'golden' ? 0xffc27a : 0xfff2d8);
    }
    if (this.hemi) this.hemi.intensity = p.hemi;
    const isNight = t === 'night';
    this.stars.material.opacity = isNight ? 0.9 : 0;
    this.moon.material.opacity = isNight ? 0.95 : 0;
    this.sunDisc.material.opacity = 1;
    // Sun position: high at day, low and warm at golden hour and morning,
    // gone at night.
    const dir = t === 'golden'
      ? new THREE.Vector3(0.85, 0.16, 0.25).normalize()
      : t === 'morning'
        ? new THREE.Vector3(0.85, 0.2, -0.3).normalize()
        : new THREE.Vector3(0.4, 0.6, 0.3).normalize();
    this.uniforms.sunDir.value.copy(dir);
    this.sunDisc.position.copy(dir).multiplyScalar(640);
    this.sunDisc.lookAt(0, 0, 0);
    if (this.sunLight) this.sunLight.position.copy(dir).multiplyScalar(180);
    for (const c of this.clouds) {
      for (const m of c.children) m.material = isNight ? c.userData.nightMat : c.userData.mat;
    }
  }

  update(dt, elapsed) {
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 480) c.position.x = -480;
    }
    // Gentle sun shimmer so the sky never looks painted on.
    const s = 1 + Math.sin(elapsed * 0.4) * 0.02;
    this.sunDisc.scale.set(s, s, 1);
  }
}
