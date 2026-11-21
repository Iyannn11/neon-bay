// Neon Bay — the city itself.
//
// One clear job: build Neon Bay — its ground, roads, buildings, neon signs,
// palms, lamps, beach and marina — and run its day/night cycle. Everything
// is smooth, curved and polished: extruded car-grade geometry, rounded
// towers, glowing signs, soft shadows. Nothing blocky on purpose.
//
// The city is a 640 m square on a 64 m block grid. Roads run every 64 m;
// buildings fill the blocks between them. All textures are drawn on canvas
// at boot, so the game loads no image files at all.

import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';
import { range, rangeInt, pick, chance } from './random.js';

const HALF = WORLD.size / 2;
const ROADS = [-288, -224, -160, -96, -32, 32, 96, 160, 224, 288];

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function glowTexture() {
  return canvasTexture(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}

function windowTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const cols = 8;
    const rows = 18;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const on = Math.random() < lit;
        g.fillStyle = on ? '#ffd98a' : 'rgba(180,220,255,0.85)';
        if (on) g.fillStyle = Math.random() < 0.5 ? '#ffd98a' : '#9fd8ff';
        g.fillRect(6 + x * 15, 8 + y * 14, 10, 8);
      }
    }
  });
}

function shopTexture(hue) {
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = hue;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    for (let x = 0; x < 5; x += 1) g.fillRect(14 + x * 48, 18, 34, 52);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 78, w, 10);
    g.fillStyle = '#111';
    g.fillRect(110, 88, 36, 40);
  });
}

function neonSignTexture(text, color) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = '900 64px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 28;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
    g.shadowBlur = 8;
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2);
  });
}

function groundTexture() {
  return canvasTexture(2048, 2048, (g, w, h) => {
    const toPx = (v) => ((v + HALF) / WORLD.size) * w;
    // Base: dark asphalt everywhere.
    g.fillStyle = '#23232e';
    g.fillRect(0, 0, w, h);
    // Bay water on the west edge, sand beach beside it.
    g.fillStyle = '#0a4a6e';
    g.fillRect(0, 0, toPx(-288), h);
    g.fillStyle = '#d9b380';
    g.fillRect(toPx(-288), 0, toPx(-256) - toPx(-288), h);
    // Sidewalk slabs: light pavement inside every block.
    g.fillStyle = '#3a3a48';
    for (let bx = -4; bx <= 4; bx += 1) {
      for (let bz = -4; bz <= 4; bz += 1) {
        const x0 = toPx(bx * 64 - 25);
        const z0 = toPx(bz * 64 - 25);
        g.fillRect(x0, z0, toPx(50), toPx(50));
      }
    }
    // Plaza at the centre-south block.
    g.fillStyle = '#4a4a5e';
    g.fillRect(toPx(7), toPx(71), toPx(50), toPx(50));
    // Road markings: centre dashes and edge lines.
    g.strokeStyle = 'rgba(255,210,62,0.85)';
    g.lineWidth = 3;
    g.setLineDash([26, 22]);
    for (const r of ROADS) {
      g.beginPath(); g.moveTo(toPx(r), 0); g.lineTo(toPx(r), h); g.stroke();
      g.beginPath(); g.moveTo(0, toPx(r)); g.lineTo(w, toPx(r)); g.stroke();
    }
    g.setLineDash([]);
    // Crosswalks at every intersection.
    g.fillStyle = 'rgba(240,240,240,0.75)';
    for (const rx of ROADS) {
      for (const rz of ROADS) {
        for (let i = -3; i <= 3; i += 1) {
          g.fillRect(toPx(rx - 9 + i * 2.6), toPx(rz - 11), 5, 22);
          g.fillRect(toPx(rx - 11), toPx(rz - 9 + i * 2.6), 22, 5);
        }
      }
    }
  });
}

const SIGN_WORDS = [
  ['NEON BAY', '#ff2e63'], ['HOTEL', '#00c2ff'], ['TACOS', '#ffd23e'],
  ['CASINO', '#b44dff'], ['CLUB NOVA', '#ff2e63'], ['RAMEN', '#2eff8f'],
  ['24H', '#00c2ff'], ['BAR', '#ffd23e'], ['PIER 9', '#00c2ff'],
  ['DANCE', '#b44dff'], ['MOTEL', '#ff2e63'], ['GYM', '#2eff8f'],
];

export function createWorld(scene, rng) {
  const group = new THREE.Group();
  const colliders = [];
  const glowTex = glowTexture();
  const glowMat = (color, scale) => {
    const m = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.scale.set(scale, scale, 1);
    return s;
  };

  // ---- Ground ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.size, WORLD.size),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.92, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- Water shimmer plane over the bay ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(34, WORLD.size),
    new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.9 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-HALF + 17, 0.15, 0);
  group.add(water);

  // ---- Buildings: four smooth types ----
  const towerTexA = windowTexture('#39415f', 0.35);
  const towerTexB = windowTexture('#2b3350', 0.5);
  const shopTexA = shopTexture('#3d2b52');
  const shopTexB = shopTexture('#24384f');
  const shopTexC = shopTexture('#4f2a2a');
  const emissiveMats = [];
  const signGlows = [];

  function addBuildingCollider(x, z, hw, hd) {
    colliders.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });
  }

  function tower(x, z, w, d, hgt, tex) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, roughness: 0.35, metalness: 0.55 });
    emissiveMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), mat);
    mesh.position.set(x, hgt / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // Rounded rooftop crown + antenna.
    const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, 3, d * 0.55), new THREE.MeshStandardMaterial({ color: 0x1a1d2e, roughness: 0.6 }));
    crown.position.set(x, hgt + 1.5, z);
    group.add(crown);
    if (chance(rng, 0.6)) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
      ant.position.set(x, hgt + 7, z);
      group.add(ant);
      const tip = glowMat(0xff2e63, 3);
      tip.position.set(x, hgt + 11.5, z);
      group.add(tip);
      signGlows.push(tip.material);
    }
    addBuildingCollider(x, z, w / 2 + 0.5, d / 2 + 0.5);
  }

  function roundTower(x, z, r, hgt) {
    const mat = new THREE.MeshStandardMaterial({ map: towerTexB, emissive: 0xffffff, emissiveMap: towerTexB, emissiveIntensity: 0.25, roughness: 0.4, metalness: 0.5 });
    emissiveMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, hgt, 14), mat);
    mesh.position.set(x, hgt / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.85, 4, 14), new THREE.MeshStandardMaterial({ color: 0x1a1d2e, roughness: 0.6 }));
    cap.position.set(x, hgt + 2, z);
    group.add(cap);
    addBuildingCollider(x, z, r + 0.5, r + 0.5);
  }

  function shopRow(x, z, w, d, tex, signText, signColor) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3, roughness: 0.7, metalness: 0.1 });
    emissiveMats.push(mat);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 9, d), mat);
    mesh.position.set(x, 4.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    // Awning: a tilted striped plane over the shopfront.
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 3.4), new THREE.MeshStandardMaterial({ color: 0xff2e63, roughness: 0.8, side: THREE.DoubleSide }));
    awn.position.set(x, 6.4, z + d / 2 + 1.2);
    awn.rotation.x = -0.5;
    group.add(awn);
    if (signText) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(13, 3.2),
        new THREE.MeshBasicMaterial({ map: neonSignTexture(signText, signColor), transparent: true }),
      );
      sign.position.set(x, 11.5, z + d / 2 + 0.4);
      group.add(sign);
      const glow = glowMat(new THREE.Color(signColor).getHex(), 9);
      glow.position.set(x, 11.5, z + d / 2 + 1.6);
      group.add(glow);
      signGlows.push(glow.material);
    }
    addBuildingCollider(x, z, w / 2 + 0.5, d / 2 + 0.5);
  }

  function curvedCorner(x, z, r, hgt, color) {
    // A quarter-round corner building: an extruded arc with a bevel — smooth, never boxy.
    const shape = new THREE.Shape();
    shape.absarc(0, 0, r, 0, Math.PI / 2, false);
    shape.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: hgt, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 3, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: towerTexA, emissive: 0xffffff, emissiveMap: towerTexA, emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.4, color });
    emissiveMats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, hgt, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    addBuildingCollider(x, z, r / 2 + 1, r / 2 + 1);
  }

  // Fill the blocks: downtown towers near the centre, shops along the boulevard.
  let placed = 0;
  for (let bx = -4; bx <= 4 && placed < WORLD.buildingCount; bx += 1) {
    for (let bz = -4; bz <= 4 && placed < WORLD.buildingCount; bz += 1) {
      if (bx === -4 && bz >= 2) continue; // marina strip stays open
      if (bx === 0 && bz === 1) continue; // the plaza stays open
      const cx = bx * 64;
      const cz = bz * 64;
      const distCentre = Math.abs(cx) + Math.abs(cz);
      const roll = rng();
      if (distCentre < 130 && roll < 0.55) {
        tower(cx + range(rng, -6, 6), cz + range(rng, -6, 6), range(rng, 20, 30), range(rng, 20, 30), range(rng, 34, 88), chance(rng, 0.5) ? towerTexA : towerTexB);
      } else if (roll < 0.75) {
        roundTower(cx, cz, range(rng, 11, 15), range(rng, 22, 46));
      } else if (roll < 0.9) {
        const [word, color] = pick(rng, SIGN_WORDS);
        shopRow(cx, cz, range(rng, 30, 44), range(rng, 16, 22), pick(rng, [shopTexA, shopTexB, shopTexC]), word, color);
      } else {
        curvedCorner(cx - 12, cz - 12, range(rng, 14, 20), range(rng, 16, 30), 0xffffff);
      }
      placed += 1;
    }
  }

  // ---- Marina: docks + a yacht ----
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });
  for (let i = 0; i < 3; i += 1) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 26), dockMat);
    dock.position.set(-272 + i * 0, 0.6, 170 + i * 34);
    dock.castShadow = true;
    group.add(dock);
  }
  const yachtHull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      (() => { const s = new THREE.Shape(); s.moveTo(-14, 0); s.quadraticCurveTo(0, 7, 14, 0); s.quadraticCurveTo(0, -4, -14, 0); return s; })(),
      { depth: 3, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 2, curveSegments: 20 },
    ),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.25, metalness: 0.3 }),
  );
  yachtHull.rotation.x = -Math.PI / 2;
  yachtHull.position.set(-300, 0.4, 240);
  group.add(yachtHull);

  // ---- Palm trees along the boulevard ----
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8f5a, roughness: 0.8 });
  for (let i = 0; i < 42; i += 1) {
    const x = pick(rng, [-252, -188, -124, -60, 4, 68, 132, 196, 260]);
    const z = -288 + i * 14 + range(rng, -4, 4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 5.5, 7), trunkMat);
    trunk.position.set(x, 2.75, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    trunk.castShadow = true;
    group.add(trunk);
    for (let f = 0; f < 6; f += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 5), frondMat);
      const a = (f / 6) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.2, 5.6, z + Math.sin(a) * 1.2);
      frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      group.add(frond);
    }
  }

  // ---- Street lamps with warm glow ----
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x22242e, roughness: 0.6, metalness: 0.6 });
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd98a, emissiveIntensity: 0.4 });
  emissiveMats.push(lampHeadMat);
  const lampGlows = [];
  for (const rx of ROADS) {
    for (let z = -260; z <= 260; z += 52) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6), lampPoleMat);
      pole.position.set(rx + 8, 3.25, z);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lampHeadMat);
      head.position.set(rx + 8, 6.6, z);
      group.add(head);
      const glow = glowMat(0xffd98a, 5);
      glow.position.set(rx + 8, 6.6, z);
      group.add(glow);
      lampGlows.push(glow.material);
    }
  }

  // ---- Stars for the night sky ----
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(420 * 3);
  for (let i = 0; i < 420; i += 1) {
    const a = rng() * Math.PI * 2;
    const e = range(rng, 0.15, 1.4);
    const r = 700;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0 }));
  group.add(stars);

  // ---- Lights ----
  const sun = new THREE.DirectionalLight(0xffe0b3, 2.4);
  sun.position.set(180, 220, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 800;
  sun.shadow.bias = -0.0004;
  group.add(sun);
  group.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x2a2a3a, 0.9);
  group.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fb4ff, 0.0);
  moon.position.set(-140, 200, -120);
  group.add(moon);

  // Sun + moon glow sprites riding the sky.
  const sunGlow = glowMat(0xffb35c, 90);
  const moonGlow = glowMat(0xcfe0ff, 40);
  moonGlow.material.opacity = 0;
  group.add(sunGlow);
  group.add(moonGlow);

  scene.add(group);
  scene.fog = new THREE.Fog(PALETTE.fogDay, 180, 720);

  const cA = new THREE.Color();
  const cB = new THREE.Color();

  function update(dt, hour) {
    // hour: 0-24. Day 6-18, sunset ~17.5-19, night 19-6.
    const dayness = hour > 6 && hour < 18.5 ? 1 : 0;
    const sunsetness = hour >= 16.5 && hour <= 19.5 ? 1 - Math.abs(hour - 18) / 1.5 : 0;
    const nightness = 1 - dayness;
    // Sky + fog.
    if (sunsetness > 0.3) {
      cA.setHex(PALETTE.skySunsetTop);
      cB.setHex(PALETTE.skySunsetBottom);
    } else if (dayness > 0.5) {
      cA.setHex(PALETTE.skyDayTop);
      cB.setHex(PALETTE.skyDayBottom);
    } else {
      cA.setHex(PALETTE.skyNightTop);
      cB.setHex(PALETTE.skyNightBottom);
    }
    scene.background = cA.clone();
    scene.fog.color.copy(cA).lerp(cB, 0.4);
    // Sun.
    const sunAngle = ((hour - 6) / 12) * Math.PI;
    sun.position.set(Math.cos(sunAngle) * 260, Math.sin(sunAngle) * 240 + 20, 120);
    sun.intensity = sunsetness > 0.3 ? 2.8 : dayness > 0.5 ? 2.4 : 0.25;
    sun.color.setHex(sunsetness > 0.3 ? 0xffb060 : 0xffe0b3);
    sunGlow.position.copy(sun.position).normalize().multiplyScalar(640);
    sunGlow.material.opacity = dayness > 0.5 ? 0.9 : 0;
    // Moon + stars.
    moon.intensity = nightness > 0.5 ? 0.9 : 0;
    moonGlow.position.set(-420, 380, -260);
    moonGlow.material.opacity = nightness > 0.5 ? 0.8 : 0;
    stars.material.opacity = nightness > 0.5 ? 0.9 : 0;
    hemi.intensity = sunsetness > 0.3 ? 1.05 : dayness > 0.5 ? 0.9 : 0.45;
    // Windows and lamps glow at night.
    const glow = 0.25 + nightness * 0.85 + sunsetness * 0.35;
    for (const m of emissiveMats) m.emissiveIntensity = glow;
    for (const m of signGlows) m.opacity = 0.35 + nightness * 0.6;
    for (const m of lampGlows) m.opacity = 0.15 + nightness * 0.75;
    // Water shimmer.
    water.position.y = 0.15 + Math.sin(performance.now() * 0.0004) * 0.05;
  }

  return {
    group,
    colliders,
    roads: ROADS,
    update,
    // Road helpers the traffic AI and missions use.
    nearestRoad(x, z) {
      let best = ROADS[0];
      let bestD = Infinity;
      for (const r of ROADS) {
        const d = Math.min(Math.abs(x - r), Math.abs(z - r));
        if (d < bestD) { bestD = d; best = r; }
      }
      return { road: best, dist: bestD };
    },
    randomRoadPoint(rngFn) {
      const vertical = chance(rngFn, 0.5);
      const road = pick(rngFn, ROADS);
      const along = range(rngFn, -280, 280);
      return vertical ? { x: road, z: along } : { x: along, z: road };
    },
  };
}
