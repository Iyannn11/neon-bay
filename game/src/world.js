// Neon Bay — the city itself. One seeded pass builds the whole map: a street
// grid with a highway ring, a beach and marina on the east edge, varied towers
// with rooftop props, neon signs, palms, lamps, shops, crates, ramps and gates.
// The ground is a single painted canvas texture (one draw call); buildings share
// a handful of window materials, so the scene stays light on a mid-range PC.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD } from './config.js';
import { mulberry32, range, int, pick, clamp } from './random.js';

const ROADS = [-256, -192, -128, -64, 0, 64, 128, 192, 256];
const BLOCK_CENTERS = [-224, -160, -96, -32, 32, 96, 160, 224];
const RING = 288; // highway ring

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function textSprite(text, color, scale = 1) {
  const tex = canvasTex(512, 128, (g) => {
    g.clearRect(0, 0, 512, 128);
    g.font = 'bold 64px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 26;
    g.fillStyle = color;
    g.fillText(text, 256, 64);
    g.shadowBlur = 8;
    g.fillStyle = '#ffffff';
    g.fillText(text, 256, 64);
  });
  const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(m);
  s.scale.set(10 * scale, 2.5 * scale, 1);
  return s;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.rng = mulberry32(1337);
    this.colliders = [];   // {minX,maxX,minZ,maxZ}
    this.billboards = [];  // {mat, phase}
    this.windowMats = [];  // emissive window materials, lit at night
    this.signMats = [];
    this.cullables = [];   // palms + lamps, hidden beyond ~380 m
    this.crates = [];      // {mesh, baseY, phase, taken}
    this.ramps = [];       // {x, z, dir}
    this.raceGates = [];   // {x, z}
    this.photoSpots = [];  // {x, z}
    this.talkSpots = [];   // {x, z, name}
    this.markers = {};     // named beacons: ammu, spray, threads, taxi, plaza, marina
    this.groundMat = null;
    this.waterMat = null;
    this.water = null;
    this.sun = null;
    this.hemi = null;
    this._build();
  }

  // ---------- ground texture ----------
  _groundTexture() {
    const S = 2048, W = WORLD.size; // 3.2 px per metre
    const px = (x) => (x + W / 2) * (S / W);
    const pw = (m) => m * (S / W);
    return canvasTex(S, S, (g) => {
      g.fillStyle = '#232529'; g.fillRect(0, 0, S, S); // asphalt base
      // sidewalks: one slab per block
      for (const bx of BLOCK_CENTERS) for (const bz of BLOCK_CENTERS) {
        if (bx === 0 && bz === 0) continue; // plaza handled below
        if (bx >= 224) continue;            // beach side
        g.fillStyle = '#34373e';
        g.fillRect(px(bx - 26), px(bz - 26), pw(52), pw(52));
        g.fillStyle = '#2e3138';
        g.fillRect(px(bx - 24), px(bz - 24), pw(48), pw(48));
      }
      // park block
      g.fillStyle = '#1f4d2e';
      g.fillRect(px(-96 - 26), px(96 - 26), pw(52), pw(52));
      g.fillStyle = '#2a6b3c';
      for (let i = 0; i < 26; i++) {
        g.beginPath();
        g.arc(px(-96 - 22 + this.rng() * 44), px(96 - 22 + this.rng() * 44), pw(2 + this.rng() * 3), 0, 7);
        g.fill();
      }
      // plaza at the centre
      g.fillStyle = '#3d3a4d';
      g.fillRect(px(-26), px(-26), pw(52), pw(52));
      g.strokeStyle = '#ff2e88'; g.lineWidth = pw(1.2);
      g.beginPath(); g.arc(px(0), px(0), pw(18), 0, 7); g.stroke();
      g.strokeStyle = '#00c2ff';
      g.beginPath(); g.arc(px(0), px(0), pw(11), 0, 7); g.stroke();
      // roads: centre dashes
      g.fillStyle = '#f5c542';
      for (const r of ROADS) {
        for (let d = -300; d < 300; d += 24) {
          g.fillRect(px(d), px(r - 0.6), pw(9), pw(1.2));
          g.fillRect(px(r - 0.6), px(d), pw(1.2), pw(9));
        }
      }
      // highway ring
      g.strokeStyle = '#c8ccd4'; g.lineWidth = pw(14);
      g.strokeRect(px(-RING), px(-RING), pw(RING * 2), pw(RING * 2));
      g.strokeStyle = '#232529'; g.lineWidth = pw(11);
      g.strokeRect(px(-RING), px(-RING), pw(RING * 2), pw(RING * 2));
      g.strokeStyle = '#f5c542'; g.lineWidth = pw(0.8);
      g.setLineDash([pw(8), pw(8)]);
      g.strokeRect(px(-RING), px(-RING), pw(RING * 2), pw(RING * 2));
      g.setLineDash([]);
      // crosswalks at the main intersections
      g.fillStyle = 'rgba(230,230,230,0.75)';
      for (const rx of [-128, 0, 128]) for (const rz of [-128, 0, 128]) {
        for (let i = -4; i <= 4; i++) g.fillRect(px(rx + i * 1.4 - 0.5), px(rz - 6.5), pw(1), pw(2.2));
      }
      // beach: sand east of x = 256, darker wet band near the water
      const grad = g.createLinearGradient(px(256), 0, px(320), 0);
      grad.addColorStop(0, '#cbb27a'); grad.addColorStop(0.7, '#d9c08a'); grad.addColorStop(1, '#b89a68');
      g.fillStyle = grad;
      g.fillRect(px(256), 0, pw(64), S);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(px(296), 0, pw(4), S);
    });
  }

  _windowMaterials() {
    const mats = [];
    const palettes = [
      ['#ffd27a', '#7ae0ff', '#ff7ad9', '#fff2c8'],
      ['#ffb36b', '#8affc1', '#c9a7ff', '#ffe9a8'],
      ['#9adcff', '#ffd27a', '#ff9d7a', '#e8f6ff'],
    ];
    for (const pal of palettes) {
      const map = canvasTex(128, 256, (g) => {
        g.fillStyle = '#2b2f3a'; g.fillRect(0, 0, 128, 256);
        g.fillStyle = '#1d2027';
        for (let y = 8; y < 248; y += 16) for (let x = 8; x < 120; x += 16) g.fillRect(x, y, 10, 10);
      });
      const emis = canvasTex(128, 256, (g) => {
        g.fillStyle = '#000000'; g.fillRect(0, 0, 128, 256);
        for (let y = 8; y < 248; y += 16) for (let x = 8; x < 120; x += 16) {
          if (this.rng() < 0.55) { g.fillStyle = pick(this.rng, pal); g.fillRect(x, y, 10, 10); }
        }
      });
      const m = new THREE.MeshStandardMaterial({
        map, emissiveMap: emis, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.85, metalness: 0.1,
      });
      mats.push(m);
      this.windowMats.push(m);
    }
    return mats;
  }

  _neonSign(text, color) {
    const tex = canvasTex(512, 128, (g) => {
      g.clearRect(0, 0, 512, 128);
      g.strokeStyle = color; g.lineWidth = 6; g.shadowColor = color; g.shadowBlur = 22;
      g.strokeRect(10, 10, 492, 108);
      g.font = 'bold 58px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffffff';
      g.fillText(text, 256, 66);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    this.signMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), mat);
    return mesh;
  }

  // ---------- construction ----------
  _build() {
    const rng = this.rng;
    const scene = this.scene;

    // Lights
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
    this.sun.position.set(120, 180, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -340; this.sun.shadow.camera.right = 340;
    this.sun.shadow.camera.top = 340; this.sun.shadow.camera.bottom = -340;
    this.sun.shadow.camera.far = 700;
    this.sun.shadow.bias = -0.0006;
    scene.add(this.sun);
    this.sunTarget = new THREE.Object3D();
    scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3230, 0.9);
    scene.add(this.hemi);

    // Ground
    this.groundMat = new THREE.MeshStandardMaterial({ map: this._groundTexture(), roughness: 0.92, metalness: 0.02 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size + 80, WORLD.size + 80), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Water (east edge)
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x0a5a7d, roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.9 });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(90, WORLD.size + 80), this.waterMat);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(300 + 45, 0.15, 0);
    scene.add(this.water);

    // ---- buildings ----
    const winMats = this._windowMaterials();
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.95 });
    const acGeo = new THREE.BoxGeometry(1.6, 0.9, 1.6);
    const acMat = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.7, metalness: 0.4 });
    const antGeo = new THREE.CylinderGeometry(0.09, 0.14, 7, 6);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x555a66, roughness: 0.5, metalness: 0.7 });
    const tipGeo = new THREE.SphereGeometry(0.28, 8, 6);
    const tipMat = new THREE.MeshBasicMaterial({ color: 0xff3355 });
    const balGeo = new THREE.BoxGeometry(1, 0.25, 1.4);
    const balMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 });
    const neonWords = ['HOTEL', 'CASINO', 'BAR 24H', 'CLUB NEON', 'PIZZA', 'MOTEL', 'DISCO', 'TACOS'];

    const addBuilding = (x, z, w, d, h, mat) => {
      const m = new THREE.Mesh(boxGeo, mat);
      m.scale.set(w, h, d);
      m.position.set(x, h / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      // roof slab
      const roof = new THREE.Mesh(boxGeo, roofMat);
      roof.scale.set(w + 0.6, 0.5, d + 0.6);
      roof.position.set(x, h + 0.25, z);
      scene.add(roof);
      // rooftop props: AC units, antennas, balconies
      if (rng() < 0.75) {
        const ac = new THREE.Mesh(acGeo, acMat);
        ac.position.set(x + range(rng, -w / 4, w / 4), h + 0.9, z + range(rng, -d / 4, d / 4));
        ac.castShadow = true;
        scene.add(ac);
      }
      if (rng() < 0.45) {
        const ant = new THREE.Mesh(antGeo, antMat);
        ant.position.set(x + range(rng, -w / 3, w / 3), h + 3.5, z + range(rng, -d / 3, d / 3));
        scene.add(ant);
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(ant.position.x, h + 7.1, ant.position.z);
        scene.add(tip);
      }
      if (rng() < 0.5) {
        for (let f = 0; f < Math.floor(h / 9); f++) {
          const bal = new THREE.Mesh(balGeo, balMat);
          bal.position.set(x + w / 2 + 0.6, 4 + f * 9, z + range(rng, -d / 4, d / 4));
          scene.add(bal);
        }
      }
      // neon sign on some towers
      if (h > 24 && rng() < 0.55) {
        const sign = this._neonSign(pick(rng, neonWords), pick(rng, ['#ff2e88', '#00e5ff', '#ffe14d', '#7dff5a']));
        sign.position.set(x, h - 2.5, z + d / 2 + 0.15);
        scene.add(sign);
      }
      return m;
    };

    for (const bx of BLOCK_CENTERS) for (const bz of BLOCK_CENTERS) {
      if (bx === 0 && bz === 0) continue;              // plaza
      if (bx === -96 && bz === 96) continue;           // park
      if (bx >= 224) continue;                         // beach
      const distC = Math.hypot(bx, bz);
      const tall = clamp(1 - distC / 420, 0.15, 1);
      if (rng() < 0.62) {
        // one tower per block
        const w = range(rng, 20, 34), d = range(rng, 20, 34);
        const h = range(rng, 9, 14) + tall * range(rng, 8, 42);
        addBuilding(bx + range(rng, -4, 4), bz + range(rng, -4, 4), w, d, h, pick(rng, winMats));
      } else {
        // two mid buildings
        for (let k = 0; k < 2; k++) {
          const w = range(rng, 14, 20), d = range(rng, 14, 20);
          const h = range(rng, 7, 12) + tall * range(rng, 4, 20);
          const ox = k === 0 ? -11 : 11, oz = k === 0 ? 10 : -10;
          addBuilding(bx + ox, bz + oz, w, d, h, pick(rng, winMats));
        }
      }
    }
    // three landmark towers near the plaza
    addBuilding(-40, -48, 26, 26, 78, winMats[0]);
    addBuilding(44, 40, 24, 24, 66, winMats[1]);
    addBuilding(48, -64, 22, 22, 58, winMats[2]);

    // ---- plaza fountain ----
    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 1, 20), new THREE.MeshStandardMaterial({ color: 0x4a4f5a, roughness: 0.6 }));
    fBase.position.set(0, 0.5, 0); fBase.castShadow = true;
    scene.add(fBase);
    const fWater = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.3, 20), new THREE.MeshStandardMaterial({ color: 0x19b8d8, roughness: 0.1, metalness: 0.4, emissive: 0x0a5a7d, emissiveIntensity: 0.4 }));
    fWater.position.set(0, 1.05, 0);
    scene.add(fWater);
    this.fountainWater = fWater;

    // ---- billboards (animated neon) ----
    const bbTexts = [
      { t: 'NEON BAY', c1: '#ff2e88', c2: '#1a0a2e' },
      { t: 'VICE NIGHTS', c1: '#00e5ff', c2: '#06121f' },
      { t: 'TURBO COLA', c1: '#ffe14d', c2: '#2e0a0a' },
      { t: 'KING OF THE BAY', c1: '#7dff5a', c2: '#0a1f0a' },
    ];
    const bbSpots = [[-96, -224, 0.4], [160, 224, -0.5], [-224, 96, 1.2], [96, -192, 2.6]];
    for (let i = 0; i < 4; i++) {
      const [x, z, ry] = bbSpots[i];
      const info = bbTexts[i];
      const tex = canvasTex(512, 256, (g) => {
        const grad = g.createLinearGradient(0, 0, 512, 256);
        grad.addColorStop(0, info.c2); grad.addColorStop(1, '#000000');
        g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
        g.font = 'bold 72px Arial, sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = info.c1; g.shadowBlur = 30;
        g.fillStyle = info.c1;
        g.fillText(info.t, 256, 110);
        g.font = 'bold 34px Arial, sans-serif';
        g.fillStyle = '#ffffff';
        g.fillText('★ NEON BAY ★', 256, 190);
      });
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), mat);
      panel.position.set(x, 13, z);
      panel.rotation.y = ry;
      scene.add(panel);
      const frame = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.8 }));
      frame.scale.set(17, 9, 0.5);
      frame.position.set(x, 13, z);
      frame.rotation.y = ry;
      frame.position.x -= Math.sin(ry) * 0.4;
      frame.position.z -= Math.cos(ry) * 0.4;
      scene.add(frame);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 9, 8), new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.7, metalness: 0.5 }));
      pole.position.set(x, 4.5, z);
      pole.castShadow = true;
      scene.add(pole);
      this.colliders.push({ minX: x - 0.8, maxX: x + 0.8, minZ: z - 0.8, maxZ: z + 0.8 });
      this.billboards.push({ mat, phase: rng() * 6 });
    }

    // ---- palms (beach + plaza), shared geo/mat ----
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 5.4, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 });
    const frondGeo = new THREE.ConeGeometry(2.4, 2.2, 7);
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2fae5f, roughness: 0.85 });
    const palmSpots = [];
    for (let z = -280; z <= 280; z += 28) {
      palmSpots.push([262 + range(rng, -3, 3), z + range(rng, -6, 6)]);
      if (rng() < 0.6) palmSpots.push([276 + range(rng, -3, 3), z + 14 + range(rng, -6, 6)]);
    }
    for (let i = 0; i < 6; i++) palmSpots.push([range(rng, -20, 20), range(rng, -20, 20)]);
    for (const [x, z] of palmSpots) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.7; trunk.rotation.z = range(rng, -0.08, 0.08);
      trunk.castShadow = true;
      const fronds = new THREE.Mesh(frondGeo, frondMat);
      fronds.position.y = 6.1; fronds.scale.set(1, 0.55, 1);
      fronds.castShadow = true;
      g.add(trunk); g.add(fronds);
      g.position.set(x, 0, z);
      g.rotation.y = rng() * Math.PI * 2;
      scene.add(g);
      this.cullables.push(g);
    }

    // ---- street lamps ----
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2d36, roughness: 0.6, metalness: 0.6 });
    const lampGeo = new THREE.SphereGeometry(0.32, 10, 8);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    this.lampMat = lampMat;
    for (const r of ROADS) {
      for (let d = -256; d <= 256; d += 64) {
        if (Math.abs(r) >= 224 && d > 200) continue;
        const g = new THREE.Group();
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 3.25;
        const head = new THREE.Mesh(lampGeo, lampMat);
        head.position.set(0, 6.6, 0);
        g.add(pole); g.add(head);
        g.position.set(r + 7, 0, d);
        scene.add(g);
        this.cullables.push(g);
      }
    }

    // ---- marina: docks + boats ----
    const dockMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const dock = new THREE.Mesh(boxGeo, dockMat);
      dock.scale.set(26, 0.5, 3);
      dock.position.set(306, 0.4, -64 + i * 64);
      dock.castShadow = true;
      scene.add(dock);
      this.colliders.push({ minX: 293, maxX: 319, minZ: -65.5 + i * 64, maxZ: -62.5 + i * 64 });
    }
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.35, metalness: 0.2 });
    const hullMat2 = new THREE.MeshStandardMaterial({ color: 0xff2e88, roughness: 0.35, metalness: 0.2 });
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1d2436, roughness: 0.3, metalness: 0.4 });
    for (let i = 0; i < 5; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(boxGeo, i % 2 ? hullMat : hullMat2);
      hull.scale.set(7, 1.4, 2.6);
      hull.position.y = 0.7;
      const cabin = new THREE.Mesh(boxGeo, cabinMat);
      cabin.scale.set(2.6, 1.2, 2);
      cabin.position.set(-0.6, 1.9, 0);
      boat.add(hull); boat.add(cabin);
      boat.position.set(312 + range(rng, -2, 6), 0.1, -96 + i * 44 + range(rng, -6, 6));
      boat.rotation.y = range(rng, -0.2, 0.2);
      scene.add(boat);
    }

    // ---- highway guard rails ----
    const railMat = new THREE.MeshStandardMaterial({ color: 0x9aa0ab, roughness: 0.4, metalness: 0.7 });
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(boxGeo, railMat);
      rail.scale.set(RING * 2 + 16, 0.9, 0.4);
      rail.position.set(0, 0.45, s * (RING + 8));
      scene.add(rail);
      const rail2 = new THREE.Mesh(boxGeo, railMat);
      rail2.scale.set(0.4, 0.9, RING * 2 + 16);
      rail2.position.set(s * (RING + 8), 0.45, 0);
      scene.add(rail2);
    }

    // ---- shops with beacons + labels ----
    const beaconGeo = new THREE.CylinderGeometry(1.6, 1.6, 7, 12, 1, true);
    const mkBeacon = (x, z, color, label, key) => {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
      const b = new THREE.Mesh(beaconGeo, mat);
      b.position.set(x, 3.5, z);
      scene.add(b);
      const s = textSprite(label, color, 0.9);
      s.position.set(x, 8.6, z);
      scene.add(s);
      this.markers[key] = { x, z, color };
      return b;
    };
    mkBeacon(-32, -96, '#39d98a', 'AMMU-NATION', 'ammu');
    mkBeacon(96, 32, '#ff9d2e', 'PAY N SPRAY', 'spray');
    mkBeacon(-96, -32, '#ff2e88', 'THREADS', 'threads');
    mkBeacon(20, 20, '#ffe14d', 'TAXI', 'taxi');
    mkBeacon(300, 0, '#00e5ff', 'MARINA', 'marina');
    mkBeacon(0, 0, '#ffffff', 'PLAZA', 'plaza');

    // ---- neon crates (10) ----
    const crateGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, emissive: 0xff2e88, emissiveIntensity: 1.4, roughness: 0.4 });
    const crateSpots = [
      [-224, -224], [224, -224], [-224, 224], [160, 160], [-160, 32],
      [32, -224], [280, -120], [280, 140], [-32, 224], [96, -96],
    ];
    for (const [x, z] of crateSpots) {
      const m = new THREE.Mesh(crateGeo, crateMat);
      m.position.set(x, 1.1, z);
      m.castShadow = true;
      scene.add(m);
      this.crates.push({ mesh: m, baseY: 1.1, phase: rng() * 6, taken: false, x, z });
    }

    // ---- stunt ramps (5) ----
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xff9d2e, roughness: 0.6 });
    const rampSpots = [[240, -64, 0], [240, 96, Math.PI], [-160, 240, Math.PI / 2], [64, 256, -Math.PI / 2], [-240, 0, Math.PI / 2]];
    for (const [x, z, ry] of rampSpots) {
      const ramp = new THREE.Mesh(boxGeo, rampMat);
      ramp.scale.set(6, 0.7, 10);
      ramp.position.set(x, 1.4, z);
      ramp.rotation.y = ry;
      ramp.rotation.x = 0; // approach wedge below does the slope
      ramp.castShadow = true;
      scene.add(ramp);
      const wedge = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.8 }));
      wedge.scale.set(6, 2.4, 5);
      wedge.position.set(x - Math.sin(ry) * 4, 1.2, z - Math.cos(ry) * 4);
      wedge.rotation.y = ry;
      wedge.rotation.z = 0.42;
      scene.add(wedge);
      this.ramps.push({ x, z, dir: ry });
    }

    // ---- race gates (3 checkered arches) ----
    const checkTex = canvasTex(128, 32, (g) => {
      for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? '#111111' : '#ffffff';
        g.fillRect(x * 16, y * 16, 16, 16);
      }
    });
    const gateSpots = [[-64, -192], [128, 64], [-192, 128]];
    for (const [x, z] of gateSpots) {
      const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 8), poleMat);
      poleL.position.set(x - 6, 3, z);
      const poleR = poleL.clone(); poleR.position.x = x + 6;
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.6), new THREE.MeshBasicMaterial({ map: checkTex, side: THREE.DoubleSide }));
      banner.position.set(x, 5.6, z);
      scene.add(poleL); scene.add(poleR); scene.add(banner);
      this.raceGates.push({ x, z });
    }

    // ---- photo spots (3) ----
    const ringGeo = new THREE.RingGeometry(1.6, 2.2, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const photoSpots = [[270, -40], [0, 224], [-224, -96]];
    for (const [x, z] of photoSpots) {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.06, z);
      scene.add(ring);
      const s = textSprite('PHOTO', '#00e5ff', 0.7);
      s.position.set(x, 4, z);
      scene.add(s);
      this.photoSpots.push({ x, z });
    }

    // ---- talk NPC spots (8 named) ----
    const talkSpots = [
      [12, 8], [-20, -12], [262, -20], [262, 60], [-40, -88],
      [88, 40], [-88, -40], [290, 20],
    ];
    for (const [x, z] of talkSpots) this.talkSpots.push({ x, z });
  }

  // ---------- runtime ----------
  update(dt, t, camPos, env) {
    // env: { night01 (0 day .. 1 night), rain01, golden01 }
    for (const b of this.billboards) {
      b.mat.color.setHSL((t * 0.03 + b.phase) % 1, 0.85, 0.62 + Math.sin(t * 2 + b.phase) * 0.1);
    }
    for (const m of this.windowMats) m.emissiveIntensity = env.night01 * 1.15;
    this.lampMat.color.setHex(env.night01 > 0.25 ? 0xffe9a8 : 0x8a8a8a);
    for (const c of this.crates) {
      if (c.taken) continue;
      c.mesh.position.y = c.baseY + Math.sin(t * 2 + c.phase) * 0.22;
      c.mesh.rotation.y = t * 0.8 + c.phase;
    }
    if (this.fountainWater) this.fountainWater.rotation.y = t * 0.4;
    if (this.water) {
      this.water.position.y = 0.15 + Math.sin(t * 0.7) * 0.08;
      this.waterMat.color.setHex(env.rain01 > 0.5 ? 0x0a3a55 : 0x0a5a7d);
    }
    // wet roads shine when it rains
    this.groundMat.roughness = env.rain01 > 0.5 ? 0.32 : 0.92;
    // cull palms + lamps beyond ~380 m of the camera
    const cx = camPos.x, cz = camPos.z;
    for (const g of this.cullables) {
      const dx = g.position.x - cx, dz = g.position.z - cz;
      g.visible = dx * dx + dz * dz < 380 * 380;
    }
  }

  // Push a circle out of building AABBs. Returns true if a collision happened.
  collide(x, z, r) {
    let hit = false;
    for (const c of this.colliders) {
      if (x + r < c.minX || x - r > c.maxX || z + r < c.minZ || z - r > c.maxZ) continue;
      const dxl = x + r - c.minX, dxr = c.maxX - (x - r);
      const dzl = z + r - c.minZ, dzr = c.maxZ - (z - r);
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = c.minX - r;
      else if (m === dxr) x = c.maxX + r;
      else if (m === dzl) z = c.minZ - r;
      else z = c.maxZ + r;
      hit = true;
    }
    return { x, z, hit };
  }

  // Nearest point on the street grid (for traffic AI + taxi routing).
  nearestRoadPoint(x, z) {
    let bx = ROADS[0], bz = ROADS[0];
    let bd = 1e9;
    for (const r of ROADS) {
      const d = Math.abs(x - r);
      if (d < bd) { bd = d; bx = r; }
    }
    bd = 1e9;
    for (const r of ROADS) {
      const d = Math.abs(z - r);
      if (d < bd) { bd = d; bz = r; }
    }
    // pick the closer axis: if nearer a vertical road, snap x; else snap z
    const dx = Math.abs(x - bx), dz = Math.abs(z - bz);
    if (dx < dz) return { x: bx, z: clamp(z, -256, 256) };
    return { x: clamp(x, -256, 256), z: bz };
  }

  isOnRoad(x, z) {
    for (const r of ROADS) {
      if (Math.abs(x - r) < 7 || Math.abs(z - r) < 7) return true;
    }
    return Math.abs(Math.abs(x) - RING) < 9 || Math.abs(Math.abs(z) - RING) < 9;
  }
}
