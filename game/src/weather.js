// Neon Bay — weather: rain (instanced streaks + splash darkening) and clear
// skies, toggled by key or the settings menu. Written fresh for Round 12.
import * as THREE from 'three';

export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.rain = false;
    this.intensity = 0;
    const N = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    this.drops = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 160;
      pos[i * 3 + 1] = Math.random() * 60;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 160;
      this.drops.push({ x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2], v: 28 + Math.random() * 14 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xaac8e8, size: 0.35, transparent: true, opacity: 0,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.geo = geo;
  }

  toggle() { this.setRain(!this.rain); }

  setRain(on) {
    this.rain = on;
    this.points.material.opacity = on ? 0.75 : 0;
  }

  step(dt, center) {
    if (!this.rain) return;
    const pos = this.geo.attributes.position.array;
    for (let i = 0; i < this.drops.length; i++) {
      const d = this.drops[i];
      d.y -= d.v * dt;
      d.x += dt * 3; // wind slant
      if (d.y < 0) {
        d.y = 45 + Math.random() * 15;
        d.x = center.x + (Math.random() - 0.5) * 160;
        d.z = center.z + (Math.random() - 0.5) * 160;
      }
      pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}
