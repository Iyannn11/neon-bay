// city.js — Neon Bay itself: the street grid, the downtown towers, the
// marina, the beach, the park and the highway ring. Everything is built from
// the seeded RNG, so the same seed always builds the same city.
// The look is HD, not blocky: towers are four distinct silhouettes with
// setbacks, spires and skybridges, glass is glossy, windows are a lit-window
// canvas texture, and every neon sign and lamp carries an additive glow sprite.

import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

// A facade texture: a dense grid of small windows, some warm-lit, some
// cool-lit, most dark. Used as both map and emissive map so the windows glow
// at night. Dense and small, so a tower reads as a real building, not a
// handful of coloured squares.
function makeFacadeTexture(rng, cols, rows, litRatio) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#101c2e';
  ctx.fillRect(0, 0, 256, 512);
  const cw = 256 / cols;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = rng.next() < litRatio;
      if (!lit) continue;
      const warm = rng.next() < 0.7;
      ctx.fillStyle = warm ? '#ffd27a' : '#9fd8ff';
      ctx.globalAlpha = 0.4 + rng.next() * 0.5;
      ctx.fillRect(c * cw + 3, r * rh + 4, cw - 6, rh - 8);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The ground: one big canvas that paints the whole street grid — asphalt,
// sidewalks, lane dashes and crosswalks — so the city reads from any height.
function makeGroundTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const world = WORLD.halfSize * 2;
  const px = (v) => ((v + WORLD.halfSize) / world) * size;
  // Asphalt everywhere.
  ctx.fillStyle = '#26292f';
  ctx.fillRect(0, 0, size, size);
  // Sidewalk blocks between streets. Blocks are centred at -140 + 40k, so
  // the streets between them sit exactly on multiples of 40 — the same grid
  // the towers, the traffic and the missions use.
  const spacing = WORLD.streetSpacing;
  const half = WORLD.halfSize;
  ctx.fillStyle = '#565b64';
  for (let x = -140; x <= 140; x += spacing) {
    for (let z = -140; z <= 140; z += spacing) {
      const bx = px(x - WORLD.blockSize / 2);
      const bz = px(z - WORLD.blockSize / 2);
      const bs = (WORLD.blockSize / world) * size;
      ctx.fillRect(bx, bz, bs, bs);
    }
  }
  // Lane dashes along every street (streets are the multiples of 40).
  ctx.fillStyle = '#cfd0b8';
  const dashLen = (6 / world) * size;
  const gapLen = (6 / world) * size;
  const streets = [];
  for (let v = -160; v <= 160; v += spacing) streets.push(v);
  for (const s of streets) {
    // Along X.
    for (let d = -half; d < half; d += dashLen + gapLen) {
      ctx.fillRect(px(d), px(s) - 1, dashLen, 2);
    }
    // Along Z.
    for (let d = -half; d < half; d += dashLen + gapLen) {
      ctx.fillRect(px(s) - 1, px(d), 2, dashLen);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A soft radial glow, used as an additive sprite on lamps, signs and beacons.
function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// A neon sign: glowing text on a dark plate, mounted on a building face.
function makeNeonSign(text, colour, width, height, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = colour;
  ctx.shadowBlur = 18;
  ctx.fillStyle = colour;
  ctx.fillText(text, 128, 34);
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  return mesh;
}

function glowSprite(tex, colour, scale) {
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color: colour,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.85,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

// One of four tower silhouettes. Returns a group; the caller positions it.
function buildTower(type, rng, facadeTex, glowTex) {
  const group = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({
    map: facadeTex,
    emissiveMap: facadeTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    color: 0x9fb8d8,
    metalness: 0.65,
    roughness: 0.25,
  });
  const darkGlass = new THREE.MeshStandardMaterial({
    map: facadeTex,
    emissiveMap: facadeTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.5,
    color: 0x7a9cc4,
    metalness: 0.7,
    roughness: 0.2,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a3242, metalness: 0.5, roughness: 0.6 });
  const neonColours = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonGold, PALETTE.neonGreen, PALETTE.neonPurple];
  const neon = neonColours[Math.floor(rng.next() * neonColours.length)];
  const neonCss = '#' + neon.toString(16).padStart(6, '0');

  if (type === 0) {
    // Slab + setback + pyramid roof.
    const h1 = 34 + rng.range(0, 18);
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, h1, 12), glass);
    base.position.y = h1 / 2;
    group.add(base);
    const h2 = 10 + rng.range(0, 8);
    const top = new THREE.Mesh(new THREE.BoxGeometry(10, h2, 8), darkGlass);
    top.position.y = h1 + h2 / 2;
    group.add(top);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 6, 4), roofMat);
    roof.position.y = h1 + h2 + 3;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    const sign = makeNeonSign(rng.pick(['CLUB', 'VICE', 'NEON', 'HOTEL']), neonCss, 12, 3, rng);
    sign.position.set(0, h1 * 0.72, 6.15);
    group.add(sign);
    const glow = glowSprite(glowTex, neon, 14);
    glow.position.set(0, h1 * 0.72, 7);
    group.add(glow);
    group.userData.height = h1 + h2 + 6;
    group.userData.footprint = 16;
  } else if (type === 1) {
    // Smooth cylinder tower + spire.
    const h = 46 + rng.range(0, 22);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(7, 8.5, h, 20), glass);
    tower.position.y = h / 2;
    group.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 14, 12), roofMat);
    spire.position.y = h + 7;
    group.add(spire);
    const beacon = glowSprite(glowTex, PALETTE.neonRed, 6);
    beacon.position.y = h + 14;
    group.add(beacon);
    const sign = makeNeonSign(rng.pick(['CASINO', 'NEON', 'VICE']), neonCss, 11, 2.8, rng);
    sign.position.set(0, h * 0.55, 8.6);
    group.add(sign);
    group.userData.height = h + 14;
    group.userData.footprint = 17;
  } else if (type === 2) {
    // Wide podium + slim tower.
    const podium = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 16), darkGlass);
    podium.position.y = 4;
    group.add(podium);
    const h = 30 + rng.range(0, 16);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(9, h, 9), glass);
    tower.position.y = 8 + h / 2;
    group.add(tower);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 2, 16), roofMat);
    cap.position.y = 8 + h + 1;
    group.add(cap);
    const sign = makeNeonSign(rng.pick(['HOTEL', 'CLUB', 'NEON']), neonCss, 13, 3.2, rng);
    sign.position.set(0, 5.5, 8.2);
    group.add(sign);
    group.userData.height = 8 + h + 2;
    group.userData.footprint = 20;
  } else {
    // Twin towers + skybridge with a neon strip.
    const h = 36 + rng.range(0, 14);
    for (const dx of [-7, 7]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.5, h, 14), glass);
      tower.position.set(dx, h / 2, 0);
      group.add(tower);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 4), darkGlass);
    bridge.position.set(0, h * 0.78, 0);
    group.add(bridge);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(14.4, 0.5, 4.4),
      new THREE.MeshBasicMaterial({ color: neon }),
    );
    strip.position.set(0, h * 0.78 + 1.3, 0);
    group.add(strip);
    const glow = glowSprite(glowTex, neon, 16);
    glow.position.set(0, h * 0.78, 3);
    group.add(glow);
    group.userData.height = h;
    group.userData.footprint = 20;
  }
  return group;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const glowTex = makeGlowTexture();
  const facadeTex = makeFacadeTexture(rng, 12, 24, 0.42);

  // Ground with the painted street grid.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.halfSize * 2, WORLD.halfSize * 2),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.85, metalness: 0.15 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Downtown towers in the block centres (streets stay clear). Block
  // centres are -140 + 40k; the towers sit in them, never on a street.
  const towerSpots = [];
  for (let bx = -100; bx <= 100; bx += 40) {
    for (let bz = -100; bz <= 100; bz += 40) {
      if (Math.abs(bx) < 1 && Math.abs(bz) < 1) continue;
      towerSpots.push([bx, bz]);
    }
  }
  // Shuffle deterministically, then place 14 towers.
  for (let i = towerSpots.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [towerSpots[i], towerSpots[j]] = [towerSpots[j], towerSpots[i]];
  }
  const signNames = ['CLUB', 'VICE', 'CASINO', 'NEON', 'HOTEL'];
  for (let i = 0; i < 14; i++) {
    const [bx, bz] = towerSpots[i];
    const type = i % 4;
    const tower = buildTower(type, rng, facadeTex, glowTex);
    tower.position.set(bx, 0, bz);
    tower.rotation.y = (Math.floor(rng.next() * 4) * Math.PI) / 2;
    group.add(tower);
    const fp = tower.userData.footprint / 2 + 1;
    colliders.push({ x: bx, z: bz, hx: fp, hz: fp });
  }
  // Low shops and houses fill the remaining blocks. They wear the same
  // lit-window facade as the towers, with a parapet roof line, so they read
  // as storefronts rather than flat boxes.
  const shopFacade = makeFacadeTexture(rng, 10, 6, 0.5);
  const shopMatA = new THREE.MeshStandardMaterial({
    map: shopFacade, emissiveMap: shopFacade, emissive: 0xffffff, emissiveIntensity: 0.45,
    color: 0xb89a7a, metalness: 0.3, roughness: 0.6,
  });
  const shopMatB = new THREE.MeshStandardMaterial({
    map: shopFacade, emissiveMap: shopFacade, emissive: 0xffffff, emissiveIntensity: 0.45,
    color: 0x8aa0b8, metalness: 0.3, roughness: 0.6,
  });
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x2a3242, metalness: 0.5, roughness: 0.6 });
  for (let i = 14; i < towerSpots.length; i++) {
    const [bx, bz] = towerSpots[i];
    if (rng.next() < 0.3) continue;
    const h = 5 + rng.range(0, 7);
    const shop = new THREE.Mesh(new THREE.BoxGeometry(14, h, 12), rng.next() < 0.5 ? shopMatA : shopMatB);
    shop.position.set(bx, h / 2, bz);
    shop.castShadow = true;
    group.add(shop);
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.7, 12.6), parapetMat);
    parapet.position.set(bx, h + 0.35, bz);
    group.add(parapet);
    colliders.push({ x: bx, z: bz, hx: 8, hz: 7 });
    // A small neon sign on some shops.
    if (rng.next() < 0.5) {
      const neon = [PALETTE.neonPink, PALETTE.neonCyan, PALETTE.neonGold, PALETTE.neonGreen][Math.floor(rng.next() * 4)];
      const sign = makeNeonSign(signNames[Math.floor(rng.next() * signNames.length)], '#' + neon.toString(16).padStart(6, '0'), 8, 2, rng);
      sign.position.set(bx, h - 1, bz + 6.2);
      group.add(sign);
    }
  }

  // Streetlights: a slim pole, a lamp head and a warm glow sprite.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.7, roughness: 0.4 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  const streetlightPositions = [];
  for (let s = -160; s <= 160; s += 40) {
    for (let d = -160; d <= 160; d += 40) {
      if (rng.next() < 0.4) continue;
      const x = s + 8;
      const z = d + 8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), poleMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), lampMat);
      lamp.position.set(x, 7.1, z);
      group.add(lamp);
      const glow = glowSprite(glowTex, 0xffd27a, 7);
      glow.position.set(x, 7.1, z);
      group.add(glow);
      streetlightPositions.push([x, z]);
    }
  }

  // Marina: water, docks and yachts (smooth hulls, not boxes).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(180, WORLD.beachDepth + 30),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.4, transparent: true, opacity: 0.9 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, WORLD.coastZ - WORLD.beachDepth / 2 - 12);
  group.add(water);
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.3, metalness: 0.2 });
  const hullMat2 = new THREE.MeshStandardMaterial({ color: 0x2a6a8a, roughness: 0.35, metalness: 0.2 });
  for (let i = 0; i < 6; i++) {
    const x = -120 + i * 48 + rng.range(-6, 6);
    const z = WORLD.coastZ - 22 - rng.range(0, 10);
    const yacht = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.4, 12, 12), i % 2 ? hullMat : hullMat2);
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1, 1, 0.55);
    hull.position.y = 1.1;
    yacht.add(hull);
    const cabin = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 4, 10), hullMat);
    cabin.position.set(0, 2.6, -1);
    yacht.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), poleMat);
    mast.position.set(0, 5, 1);
    yacht.add(mast);
    yacht.position.set(x, 0, z);
    yacht.rotation.y = rng.range(-0.2, 0.2);
    group.add(yacht);
  }
  // Wooden docks.
  const dockMat = new THREE.MeshStandardMaterial({ color: PALETTE.boardwalk, roughness: 0.9 });
  for (const dx of [-150, -60, 30, 120]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 24), dockMat);
    dock.position.set(dx, 0.3, WORLD.coastZ - 6);
    group.add(dock);
  }

  // Beach and boardwalk along the coast.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(380, WORLD.beachDepth),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.04, WORLD.coastZ - WORLD.beachDepth / 2 + 12);
  group.add(sand);
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(380, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: PALETTE.boardwalk, roughness: 0.9 }),
  );
  boardwalk.position.set(0, 0.25, WORLD.coastZ + 2);
  group.add(boardwalk);

  // Park: green lawn, smooth trees (cylinder trunk + sphere canopy).
  const park = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 }),
  );
  park.rotation.x = -Math.PI / 2;
  park.position.set(140, 0.06, 140);
  group.add(park);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a2e, roughness: 0.9 });
  for (let i = 0; i < 12; i++) {
    const x = 140 + rng.range(-30, 30);
    const z = 140 + rng.range(-30, 30);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.5, 8), trunkMat);
    trunk.position.set(x, 1.75, z);
    group.add(trunk);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.4 + rng.range(0, 1.2), 12, 10), leafMat);
    canopy.position.set(x, 4.6, z);
    canopy.scale.y = 0.8;
    group.add(canopy);
    colliders.push({ x, z, hx: 0.6, hz: 0.6 });
  }

  // Lighthouse on the east point, with a sweeping beam glow.
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.6 });
  const lighthouse = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 14), lightMat);
  lighthouse.position.set(175, 13, -175);
  group.add(lighthouse);
  const beacon = glowSprite(glowTex, 0xffffff, 22);
  beacon.position.set(175, 27, -175);
  group.add(beacon);
  colliders.push({ x: 175, z: -175, hx: 5, hz: 5 });

  // The big NEON BAY sign over the downtown gate.
  const bigSign = makeNeonSign('NEON BAY', '#00e5ff', 30, 7.5, rng);
  bigSign.position.set(0, 26, -118);
  group.add(bigSign);
  const bigGlow = glowSprite(glowTex, PALETTE.neonCyan, 34);
  bigGlow.position.set(0, 26, -116);
  group.add(bigGlow);

  // Highway ring: a flat torus band around the city.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(WORLD.ringRadius - 6, WORLD.ringRadius + 6, 64),
    new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.85 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  group.add(ring);

  // Day / night switching: sky, fog, sun and window glow.
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a2a1a, 0.9);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8aa8ff, 0.7);
  moon.position.set(-80, 140, -100);
  scene.add(moon);

  function setNight(night) {
    if (night) {
      scene.background = new THREE.Color(PALETTE.skyNight);
      scene.fog = new THREE.Fog(PALETTE.fogNight, 120, 420);
      sun.intensity = 0.12;
      hemi.intensity = 0.25;
      moon.intensity = 0.85;
    } else {
      scene.background = new THREE.Color(PALETTE.skyDay);
      scene.fog = new THREE.Fog(PALETTE.fogDay, 160, 520);
      sun.intensity = 2.2;
      hemi.intensity = 0.9;
      moon.intensity = 0.0;
    }
  }

  return { group, colliders, setNight, streetlightPositions, glowTex };
}
