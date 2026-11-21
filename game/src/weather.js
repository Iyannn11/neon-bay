// Neon Bay — weather. Clear skies or a full rainstorm: falling streaks,
// a grey overcast dome, and darker fog. Toggle with V or in Settings.
import * as THREE from 'three';

export class Weather {
  constructor(scene, sky) {
    this.scene = scene;
    this.sky = sky;
    this.mode = 'clear';
    this.rainCount = 1600;
    const pos = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120;
      pos[i * 3 + 1] = Math.random() * 50;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xaac4de, size: 0.35, transparent: true, opacity: 0.7,
    }));
    this.rain.visible = false;
    this.rain.name = 'rain';
    scene.add(this.rain);
    this.offset = new THREE.Vector3();
  }

  set(mode) {
    this.mode = mode;
    this.rain.visible = mode === 'rain';
    if (mode === 'rain') {
      // Overcast: dim the sun, grey the dome and the fog.
      this.sky.uniforms.topColor.value.setHex(0x3a4252);
      this.sky.uniforms.horizonColor.value.setHex(0x6a7078);
      this.sky.scene.fog.color.setHex(0x4a5058);
      this.sky.scene.background.setHex(0x4a5058);
      if (this.sky.sunLight) this.sky.sunLight.intensity = 0.9;
      if (this.sky.hemi) this.sky.hemi.intensity = 0.5;
    } else {
      this.sky.setTime(this.sky.timeOfDay);
    }
  }

  toggle() {
    this.set(this.mode === 'rain' ? 'clear' : 'rain');
    return this.mode;
  }

  update(dt, playerPos) {
    if (this.mode !== 'rain') return;
    const pos = this.rain.geometry.attributes.position;
    for (let i = 0; i < this.rainCount; i++) {
      let y = pos.getY(i) - dt * 42;
      if (y < 0) {
        y = 45 + Math.random() * 5;
        pos.setX(i, playerPos.x + (Math.random() - 0.5) * 120);
        pos.setZ(i, playerPos.z + (Math.random() - 0.5) * 120);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    this.rain.position.set(0, 0, 0);
  }
}
