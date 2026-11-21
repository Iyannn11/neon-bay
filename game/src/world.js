// Neon Bay — the city itself. Density is the whole point of Round 12: every
// street has lamps, palms, benches, signs and hydrants; every tower has a
// detailed facade, rooftop props and a neon sign; the plaza, marina and beach
// are dressed, not empty. Written fresh for Round 12 — no old code read.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { makeRng, clamp } from './random.js';
import {
  asphaltTexture, sidewalkTexture, plazaTexture, sandTexture, waterTexture,
  facadeTexture, glassTexture, neonSignTexture, billboardTexture, glowTexture,
} from './textures.js';

const rng = makeRng(CITY.seed);

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.08, ...opts });
}
function emissive(color, intensity = 1.6) {
  return new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
}

export class World {
  constructor(scene, sky) {
    this.scene = scene;
    this.sky = sky;
    this.colliders = []; // {x0,z0,x1,z1}
    this.trafficLoops = [];
    this.crateSpawns = [];
    this.carSpawns = [];
    this.boatPos = new THREE.Vector3(132, 0, 132);
    this.shopPos = {
      ammo: new THREE.Vector3(-18, 0, -38),
      threads: new THREE.Vector3(22, 0, -38),
      spray: new THREE.Vector3(-38, 0, 22),
    };
    this.playerSpawn = new THREE.Vector3(0, 0, 14);
    this.glowTex = glowTexture('#ffffff');
    this.waterMats = [];
    this.buildGround();
    this.buildRoads();
    this.buildPlaza();
    this.buildBuildings();
    this.buildStreetProps();
    this.buildMarina();
    this.buildBeach();
    this.buildBillboards();
  }

  addBox(w, h, d, material, x, y, z, ry = 0, parent = this.scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.rotation.y = ry;
    parent.add(m);
    return m;
  }

  addCollider(x, z, hw, hd) {
    this.colliders.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });
  }

  isBlocked(x, z, r) {
    for (const c of this.colliders) {
      if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return true;
    }
    return false;
  }

  // --- ground ---------------------------------------------------------------
  buildGround() {
    // dark base under everything (so gaps never show sky)
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 420),
      mat(0x14171c, { roughness: 1 }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(70, -0.05, 0);
    this.scene.add(base);
    // sea floor (visible through the water at the shore)
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(90, 420), mat(0x9a7f52));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(280, -0.4, 0);
    this.scene.add(sand);
  }

  buildRoads() {
    const asphalt = asphaltTexture();
    const walk = sidewalkTexture();
    const roadMat = new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.92 });
    const walkMat = new THREE.MeshStandardMaterial({ map: walk, roughness: 0.95 });
    // avenues run along z, streets along x
    for (const ax of CITY.avenues) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, 340), roadMat.clone());
      road.material.map = asphalt.clone();
      road.material.map.repeat.set(1, 12);
      road.material.map.needsUpdate = true;
      road.rotation.x = -Math.PI / 2;
      road.position.set(ax, 0.02, 0);
      this.scene.add(road);
      for (const s of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(CITY.sidewalk, 340), walkMat.clone());
        sw.material.map = walk.clone();
        sw.material.map.repeat.set(1, 40);
        sw.material.map.needsUpdate = true;
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(ax + s * (CITY.roadWidth / 2 + CITY.sidewalk / 2), 0.06, 0);
        this.scene.add(sw);
      }
    }
    for (const sz of CITY.streets) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(340, CITY.roadWidth), roadMat.clone());
      road.material.map = asphalt.clone();
      road.material.map.repeat.set(12, 1);
      road.material.map.needsUpdate = true;
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.04, sz);
      this.scene.add(road);
      for (const s of [-1, 1]) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(340, CITY.sidewalk), walkMat.clone());
        sw.material.map = walk.clone();
        sw.material.map.repeat.set(40, 1);
        sw.material.map.needsUpdate = true;
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(0, 0.08, sz + s * (CITY.roadWidth / 2 + CITY.sidewalk / 2));
        this.scene.add(sw);
      }
    }
    // zebra crossings at every intersection
    const zebraMat = mat(0xe8e8e8, { roughness: 0.9 });
    for (const ax of CITY.avenues) for (const sz of CITY.streets) {
      for (let i = -2; i <= 2; i++) {
        this.addBox(1.1, 0.06, 3.2, zebraMat, ax + i * 2.6, 0.06, sz - CITY.roadWidth / 2 - 1.2);
        this.addBox(1.1, 0.06, 3.2, zebraMat, ax + i * 2.6, 0.06, sz + CITY.roadWidth / 2 + 1.2);
      }
    }
    // traffic loops: rectangles around each block, for traffic AI
    const lines = [...CITY.avenues, ...CITY.streets];
    for (let i = 0; i < 4; i++) {
      const x0 = CITY.avenues[i] + 3.5, x1 = CITY.avenues[i + 1] - 3.5;
      const z0 = CITY.streets[i] + 3.5, z1 = CITY.streets[i + 1] - 3.5;
      this.trafficLoops.push([
        new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 0, z0),
        new THREE.Vector3(x1, 0, z1), new THREE.Vector3(x0, 0, z1),
      ]);
    }
    // highway ring loop (outer)
    this.trafficLoops.push([
      new THREE.Vector3(-141, 0, -141), new THREE.Vector3(141, 0, -141),
      new THREE.Vector3(141, 0, 141), new THREE.Vector3(-141, 0, 141),
    ]);
  }

  // --- plaza ------------------------------------------------------------------
  buildPlaza() {
    const plazaMat = new THREE.MeshStandardMaterial({ map: plazaTexture(), roughness: 0.9 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(CITY.plazaR, 40), plazaMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(0, 0.1, 0);
    this.scene.add(disc);
    // fountain: basin + water + column + pink beam
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.1, 28), mat(0x9aa2ad));
    basin.position.set(0, 0.55, 0); this.scene.add(basin);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(8.4, 28),
      new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.25, metalness: 0.35 }),
    );
    water.rotation.x = -Math.PI / 2; water.position.set(0, 1.05, 0);
    this.scene.add(water);
    this.waterMats.push(water.material);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 7, 16), mat(0xd8dce2));
    col.position.set(0, 4.4, 0); this.scene.add(col);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), emissive(PALETTE.neonPink, 2.4));
    orb.position.set(0, 8.6, 0); this.scene.add(orb);
    // pink light beam (short + narrow + soft — a glow, not a wall)
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.1, 14, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff2e88, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(0, 15, 0); this.scene.add(beam);
    this.addCollider(0, 0, 10, 10);
    // plaza benches + lamps + planters around the rim
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const px = Math.cos(a) * 21, pz = Math.sin(a) * 21;
      this.bench(px, pz, -a + Math.PI / 2);
      this.planter(px + Math.cos(a + 0.4) * 4, pz + Math.sin(a + 0.4) * 4);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.lamp(Math.cos(a) * 29, Math.sin(a) * 29, i % 2 === 0 ? PALETTE.neonPink : PALETTE.neonCyan);
    }
    // kiosk
    this.kiosk(-20, -16);
    this.kiosk(20, 16);
  }

  bench(x, z, ry) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const wood = mat(0x8a5a2e);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.9), wood);
    seat.position.y = 0.55; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.14), wood);
    back.position.set(0, 1.0, -0.42); g.add(back);
    for (const s of [-1.3, 1.3]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.8), mat(0x22262c));
      leg.position.set(s, 0.28, 0); g.add(leg);
    }
    this.scene.add(g);
  }

  planter(x, z) {
    const box = this.addBox(1.6, 0.8, 1.6, mat(0x5a5148), x, 0.4, z);
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), mat(0x2f7a3a, { roughness: 1 }));
    shrub.position.set(x, 1.2, z); shrub.scale.y = 0.75;
    this.scene.add(shrub);
    this.addCollider(x, z, 0.9, 0.9);
    return box;
  }

  lamp(x, z, glowColor = 0xffd9a0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 5.4, 8), mat(0x1c2026));
    pole.position.y = 2.7; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), mat(0x1c2026));
    arm.position.set(0.7, 5.3, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), emissive(0xffe9b0, 2.2));
    head.position.set(1.35, 5.25, 0); g.add(head);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: glowColor, transparent: true, opacity: 0.55, depthWrite: false }));
    glow.scale.set(3.4, 3.4, 1); glow.position.set(1.35, 5.2, 0); g.add(glow);
    this.scene.add(g);
    return g;
  }

  kiosk(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), mat(0x274b63));
    body.position.y = 1.5; g.add(body);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.18, 3.6), mat(0xff2e88));
    awn.position.y = 3.15; g.add(awn);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 0.9),
      new THREE.MeshBasicMaterial({ map: neonSignTexture('KIOSK', '#00e5ff'), transparent: true }),
    );
    sign.position.set(0, 2.4, 1.55); g.add(sign);
    this.scene.add(g);
    this.addCollider(x, z, 2.2, 1.7);
  }

  // --- buildings ---------------------------------------------------------------
  buildBuildings() {
    const signs = [
      ['HOTEL', '#ff2e88'], ['VISTA', '#00e5ff'], ['TOWER', '#ffc233'],
      ['CASINO', '#b14aff'], ['NEON', '#00e5ff'], ['PLAZA', '#ffc233'],
      ['BAY', '#ff2e88'], ['LUMEN', '#9fe8ff'],
    ];
    const blockLines = [-120, -60, 0, 60, 120];
    let signIdx = 0;
    for (let bi = 0; bi < 4; bi++) for (let bj = 0; bj < 4; bj++) {
      const bx0 = blockLines[bi], bx1 = blockLines[bi + 1] ?? 180;
      const bz0 = blockLines[bj], bz1 = blockLines[bj + 1] ?? 180;
      const cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2;
      // skip plaza block, marina corner, beach side
      if (Math.abs(cx) < 46 && Math.abs(cz) < 46) continue;
      if (cx > 80 && cz > 80) continue;
      if (cx > 150) continue;
      const n = rng.int(1, 2);
      for (let k = 0; k < n; k++) {
        const w = rng.range(13, 20), d = rng.range(13, 20);
        const h = rng.range(11, 44);
        const px = cx + (k === 0 ? -9 : 9) + rng.range(-3, 3);
        const pz = cz + rng.range(-8, 8);
        const kind = rng.pick(['box', 'box', 'stepped', 'cylinder', 'glass']);
        this.tower(px, pz, w, d, h, kind, signs[signIdx % signs.length]);
        signIdx++;
        this.addCollider(px, pz, w / 2 + 0.6, d / 2 + 0.6);
      }
    }
    // shop fronts near the plaza (ground-floor stores with signs)
    this.shopFront(this.shopPos.ammo.x, this.shopPos.ammo.z, 'AMMU-NATION', '#ff5a3c', 0);
    this.shopFront(this.shopPos.threads.x, this.shopPos.threads.z, 'THREADS', '#00e5ff', 0);
    this.shopFront(this.shopPos.spray.x, this.shopPos.spray.z, 'PAY N SPRAY', '#ffc233', Math.PI / 2);
  }

  tower(x, z, w, d, h, kind, sign) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const variant = rng.int(0, 5);
    if (kind === 'cylinder') {
      const tex = facadeTexture(variant);
      tex.repeat.set(Math.max(2, Math.round(w / 7)), Math.max(1, Math.round(h / 26)));
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(w / 2, w / 2 * 1.06, h, 20),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
      );
      body.position.y = h / 2; g.add(body);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(w / 2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a2f38, { roughness: 0.5, metalness: 0.4 }));
      dome.position.y = h; dome.scale.y = 0.5; g.add(dome);
    } else if (kind === 'glass') {
      const tex = glassTexture();
      tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 26)));
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.55 }),
      );
      body.position.y = h / 2; g.add(body);
    } else {
      const tex = facadeTexture(variant);
      tex.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 26)));
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }),
      );
      body.position.y = h / 2; g.add(body);
      if (kind === 'stepped') {
        const tex2 = facadeTexture((variant + 2) % 6);
        tex2.repeat.set(1, Math.max(1, Math.round(h * 0.4 / 26)));
        const top = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.62, h * 0.42, d * 0.62),
          new THREE.MeshStandardMaterial({ map: tex2, roughness: 0.85 }),
        );
        top.position.y = h + h * 0.21; g.add(top);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62 + 0.6, 0.5, d * 0.62 + 0.6), mat(0x1c2026));
        cap.position.y = h + h * 0.42 + 0.2; g.add(cap);
      }
    }
    // rooftop props: water tank + AC units + antenna (never a bare roof)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 10), mat(0x7a5a34));
    tank.position.set(w * 0.22, h + 1.6, -d * 0.2); g.add(tank);
    const tankTop = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.1, 10), mat(0x5e4526));
    tankTop.position.set(w * 0.22, h + 3.4, -d * 0.2); g.add(tankTop);
    for (let i = 0; i < 3; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), mat(0x9aa2ad));
      ac.position.set(-w * 0.25 + i * 2.2, h + 0.5, d * 0.22);
      g.add(ac);
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 5, 6), mat(0x22262c));
    ant.position.set(-w * 0.3, h + 2.6, -d * 0.28); g.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), emissive(0xff2e3c, 2.5));
    tip.position.set(-w * 0.3, h + 5.2, -d * 0.28); g.add(tip);
    // neon sign on the facade (facing the nearest road)
    const [txt, col] = sign;
    const signMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(11, w * 0.72), 2.6),
      new THREE.MeshBasicMaterial({ map: neonSignTexture(txt, col), transparent: true }),
    );
    signMesh.position.set(0, h * 0.72, d / 2 + 0.08);
    g.add(signMesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: col, transparent: true, opacity: 0.4, depthWrite: false }));
    glow.scale.set(12, 4, 1); glow.position.set(0, h * 0.72, d / 2 + 0.6); g.add(glow);
    this.scene.add(g);
    return g;
  }

  shopFront(x, z, name, color, ry) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = ry;
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 5.5, 6), mat(0x2a2f38));
    body.position.y = 2.75; g.add(body);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.25, 7), mat(0x11141a));
    awn.position.y = 5.6; g.add(awn);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, 2.1),
      new THREE.MeshBasicMaterial({ map: neonSignTexture(name, color), transparent: true }),
    );
    sign.position.set(0, 4.4, 3.1); g.add(sign);
    // lit shopfront windows
    const win = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.2), emissive(0xffe9a8, 1.4));
    win.position.set(0, 1.6, 3.06); g.add(win);
    this.scene.add(g);
    this.addCollider(x, z, 5.4, 3.4);
  }

  // --- street props -------------------------------------------------------------
  buildStreetProps() {
    // lamps + palms along every avenue and street
    for (const ax of CITY.avenues) {
      for (let z = -140; z <= 140; z += 28) {
        if (Math.abs(z) < 34) continue; // plaza keeps its own lamps
        this.lamp(ax - 9.5, z, 0xffd9a0);
        if (rng.chance(0.5)) this.palm(ax + 9.5, z + 14);
      }
    }
    for (const sz of CITY.streets) {
      for (let x = -140; x <= 140; x += 28) {
        if (Math.abs(x) < 34) continue;
        this.lamp(x, sz - 9.5, 0xffd9a0);
        if (rng.chance(0.4)) this.hydrant(x + 8, sz + 9.5);
      }
    }
    // benches + planters along sidewalks
    for (let i = 0; i < 14; i++) {
      const ax = CITY.avenues[rng.int(0, 4)];
      const z = rng.range(-130, 130);
      if (Math.abs(z) < 34) continue;
      this.bench(ax + 9.5, z, Math.PI / 2);
      this.planter(ax - 9.5, z + 6);
    }
    // street-name signs at intersections
    const names = ['OCEAN DR', 'PALM AVE', 'VICE ST', 'SUNSET BLVD', 'NEON BLVD', 'BAY ST'];
    let ni = 0;
    for (const ax of CITY.avenues) for (const sz of CITY.streets) {
      if (Math.abs(ax) < 1 && Math.abs(sz) < 1) continue;
      this.streetSign(ax + 9.5, sz + 9.5, names[ni % names.length], ni % 2 === 0 ? '#00e5ff' : '#ffc233');
      ni++;
    }
    // traffic lights at the four central intersections
    for (const [ax, sz] of [[-60, -60], [60, -60], [-60, 60], [60, 60]]) {
      this.trafficLight(ax + 8.5, sz + 8.5);
    }
    // bus stops
    this.busStop(-60, 34); this.busStop(60, -34); this.busStop(120, 94);
  }

  palm(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.5, 8), mat(0x6e4a26));
    trunk.position.y = 3.25; trunk.rotation.z = 0.08; g.add(trunk);
    const frondMat = mat(0x2f8a4a, { roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), frondMat);
      const a = (i / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.2, 6.6, Math.sin(a) * 1.2);
      frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      frond.scale.set(1, 1, 0.28);
      g.add(frond);
    }
    const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), mat(0x8a6a2e));
    nuts.position.set(0.3, 6.3, 0); g.add(nuts);
    this.scene.add(g);
    this.addCollider(x, z, 0.5, 0.5);
  }

  hydrant(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.9, 8), mat(0xc22a2a));
    body.position.y = 0.45; g.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat(0xc22a2a));
    top.position.y = 0.95; g.add(top);
    this.scene.add(g);
  }

  streetSign(x, z, text, color) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), mat(0x3a3f46));
    pole.position.y = 1.7; g.add(pole);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.7),
      new THREE.MeshBasicMaterial({ map: neonSignTexture(text, color), transparent: true }),
    );
    board.position.y = 3.2; board.rotation.y = Math.PI / 4; g.add(board);
    this.scene.add(g);
    this.addCollider(x, z, 0.3, 0.3);
  }

  trafficLight(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.6, 8), mat(0x1c2026));
    pole.position.y = 2.3; g.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.4), mat(0x14181f));
    box.position.set(0, 4.4, 0); g.add(box);
    const colors = [0xff2e3c, 0xffc233, 0x2eff7a];
    colors.forEach((c, i) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), emissive(c, i === 2 ? 2.2 : 0.4));
      lamp.position.set(0, 4.85 - i * 0.42, 0.22); g.add(lamp);
    });
    this.scene.add(g);
  }

  busStop(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    for (const s of [-2.2, 2.2]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), mat(0x22262c));
      post.position.set(s, 1.3, 0); g.add(post);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.16, 1.8), mat(0x00e5ff, { roughness: 0.4, metalness: 0.3 }));
    roof.position.y = 2.7; g.add(roof);
    this.bench(0, 0, 0);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.5),
      new THREE.MeshBasicMaterial({ map: neonSignTexture('BUS', '#00e5ff'), transparent: true }),
    );
    sign.position.set(0, 2.3, 0.1); g.add(sign);
    this.scene.add(g);
  }

  buildBillboards() {
    const spots = [[-132, -40, 0.4], [132, 40, -2.2], [40, -132, 1.6]];
    for (const [x, z, ry] of spots) {
      const g = new THREE.Group();
      g.position.set(x, 0, z); g.rotation.y = ry;
      for (const s of [-4, 4]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 11, 0.5), mat(0x22262c));
        post.position.set(s, 5.5, 0); g.add(post);
      }
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(13, 6.5),
        new THREE.MeshBasicMaterial({ map: billboardTexture() }),
      );
      board.position.y = 14; g.add(board);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), mat(0x14181f));
      back.position.set(0, 14, -0.15); back.rotation.y = Math.PI; g.add(back);
      this.scene.add(g);
      this.addCollider(x, z, 1, 1);
    }
  }

  // --- marina --------------------------------------------------------------------
  buildMarina() {
    const m = CITY.marina;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(m.x1 - m.x0, m.z1 - m.z0),
      new THREE.MeshStandardMaterial({ map: waterTexture(), color: 0x7fb8d8, roughness: 0.15, metalness: 0.55 }),
    );
    water.material.map.repeat.set(3, 3);
    water.rotation.x = -Math.PI / 2;
    water.position.set((m.x0 + m.x1) / 2, 0.12, (m.z0 + m.z1) / 2);
    this.scene.add(water);
    this.waterMats.push(water.material);
    // wooden docks: planks + posts + ropes + crates + lamps
    const wood = mat(0x7a5a34);
    const woodDark = mat(0x5e4526);
    for (let d = 0; d < 3; d++) {
      const z = m.z0 + 14 + d * 24;
      const dock = this.addBox(m.x1 - m.x0 - 8, 0.5, 4, wood, (m.x0 + m.x1) / 2, 0.35, z);
      // plank lines
      for (let i = 0; i < 12; i++) {
        this.addBox(0.18, 0.06, 4.1, woodDark, m.x0 + 8 + i * 5.4, 0.62, z);
      }
      // dock posts + rope
      for (let i = 0; i < 6; i++) {
        const px = m.x0 + 8 + i * 11;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 6), woodDark);
        post.position.set(px, 1.0, z + 1.8); this.scene.add(post);
      }
      // crates on the dock
      for (let i = 0; i < 3; i++) {
        const cx = m.x0 + 14 + i * 18 + rng.range(-2, 2);
        const crate = this.addBox(1.8, 1.8, 1.8, mat(0xb98a3e), cx, 1.5, z - 0.8);
        this.addBox(1.9, 0.14, 1.9, woodDark, cx, 2.45, z - 0.8);
        this.crateSpawns.push(new THREE.Vector3(cx, 1.5, z - 0.8));
      }
      this.lamp(m.x0 + 6, z, PALETTE.neonCyan);
    }
    // boats: hull + cabin + mast + stripe (varied colours)
    const boatCols = [0xe84a4a, 0x3a7bd5, 0xf2f2f2, 0xffc233, 0x2f8a6a];
    for (let i = 0; i < 5; i++) {
      const bx = m.x0 + 16 + i * 13, bz = m.z0 + 26 + (i % 2) * 26;
      const col = boatCols[i % boatCols.length];
      const g = new THREE.Group();
      g.position.set(bx, 0.2, bz); g.rotation.y = (i % 2 === 0 ? 0 : Math.PI / 2) + rng.range(-0.2, 0.2);
      const hull = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 2.8), mat(col));
      hull.position.y = 0.6; g.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.4, 4), mat(col));
      bow.rotation.set(0, Math.PI / 4, -Math.PI / 2); bow.position.set(5, 0.6, 0); g.add(bow);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 2.2), mat(0xf2f2f2));
      cabin.position.set(-0.6, 1.9, 0); g.add(cabin);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 6), mat(0x22262c));
      mast.position.set(1.4, 3.4, 0); g.add(mast);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(8.1, 0.3, 2.9), emissive(0xffffff, 0.8));
      stripe.position.y = 1.2; g.add(stripe);
      this.scene.add(g);
    }
    // buoys bobbing in the basin
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), mat(i % 2 ? 0xff5a3c : 0xffc233));
      b.position.set(m.x0 + 8 + rng.range(0, 56), 0.35, m.z0 + 8 + rng.range(0, 56));
      b.userData.bob = Math.random() * 6;
      this.scene.add(b);
      this.buoys = this.buoys || [];
      this.buoys.push(b);
    }
    // marina edge promenade: palms + benches + lamps
    for (let x = m.x0; x <= m.x1; x += 18) {
      this.palm(x, m.z0 - 6);
      this.bench(x + 9, m.z0 - 6, 0);
      this.lamp(x + 4, m.z0 - 4, PALETTE.neonCyan);
    }
  }

  // --- beach -----------------------------------------------------------------------
  buildBeach() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.beachX1 - CITY.beachX0, 340),
      new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }),
    );
    sand.material.map.repeat.set(2, 8);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set((CITY.beachX0 + CITY.beachX1) / 2, 0.03, 0);
    this.scene.add(sand);
    // sea (animated in main loop via texture offset)
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.seaX1 - CITY.seaX0, 420),
      new THREE.MeshStandardMaterial({ map: waterTexture(), roughness: 0.15, metalness: 0.45 }),
    );
    sea.material.map.repeat.set(2, 6);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set((CITY.seaX0 + CITY.seaX1) / 2, 0.1, 0);
    this.scene.add(sea);
    this.waterMats.push(sea.material);
    this.seaMat = sea.material;
    // wet sand strip + foam line
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(6, 340), mat(0xb89a68, { roughness: 0.6 }));
    wet.rotation.x = -Math.PI / 2;
    wet.position.set(CITY.seaX0 - 3, 0.05, 0);
    this.scene.add(wet);
    // umbrellas + towels + balls + people spots, clustered (never an empty expanse)
    const umbCols = [0xff2e88, 0x00e5ff, 0xffc233, 0xb14aff, 0x2eff7a];
    for (let i = 0; i < 12; i++) {
      const x = CITY.beachX0 + 8 + rng.range(0, 52);
      const z = -150 + i * 27 + rng.range(-6, 6);
      const col = umbCols[i % umbCols.length];
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), mat(0x8a8f96));
      pole.position.y = 1.3; g.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.0, 10), mat(col, { roughness: 0.9 }));
      top.position.y = 2.9; g.add(top);
      this.scene.add(g);
      // towel beside it
      const towel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.1), mat(umbCols[(i + 2) % umbCols.length]));
      towel.position.set(x + 2.6, 0.1, z + 1.2); towel.rotation.y = rng.range(0, 1);
      this.scene.add(towel);
      // beach ball
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), mat(0xffffff));
      ball.position.set(x - 2.4, 0.55, z - 1.4); this.scene.add(ball);
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.51, 12, 8, 0, Math.PI * 2, 0, 0.6), mat(col));
      stripe.position.copy(ball.position); this.scene.add(stripe);
    }
    // palms along the beachfront (dense row)
    for (let z = -160; z <= 160; z += 16) {
      this.palm(CITY.beachX0 + 4, z + rng.range(-3, 3));
    }
    // volleyball net
    const vg = new THREE.Group();
    vg.position.set(CITY.beachX0 + 30, 0, -40);
    for (const s of [-4, 4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), mat(0x8a8f96));
      post.position.set(s, 1.3, 0); vg.add(post);
    }
    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
    );
    net.position.y = 2.0; vg.add(net);
    this.scene.add(vg);
    // lifeguard tower
    const lg = new THREE.Group();
    lg.position.set(CITY.beachX0 + 12, 0, 60);
    for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), mat(0xf2f2f2));
      leg.position.set(sx, 1.7, sz); lg.add(leg);
    }
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.6, 3.2), mat(0xff5a3c));
    cab.position.y = 4.2; lg.add(cab);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.2, 4), mat(0xffc233));
    roof.position.y = 5.6; roof.rotation.y = Math.PI / 4; lg.add(roof);
    this.scene.add(lg);
    this.addCollider(CITY.beachX0 + 12, 60, 2, 2);
    // boardwalk edge: lamps + benches along the sand's west edge
    for (let z = -150; z <= 150; z += 30) {
      this.lamp(CITY.beachX0 - 4, z, PALETTE.neonGold);
      this.bench(CITY.beachX0 - 4, z + 12, Math.PI / 2);
    }
  }

  update(dt, t) {
    for (const m of this.waterMats) {
      if (m.map) { m.map.offset.x = (t * 0.008) % 1; m.map.offset.y = (t * 0.005) % 1; }
    }
    if (this.buoys) for (const b of this.buoys) b.position.y = 0.35 + Math.sin(t * 1.4 + b.userData.bob) * 0.12;
  }
}
