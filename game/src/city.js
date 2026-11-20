// Neon Bay city: the coastal grid, its towers, marina, beach, park and lights.
// Towers sit in block centres (streets stay clear); the ground is one canvas
// texture with the whole street grid drawn on it. Everything is smooth
// geometry — cylinders, cones and extruded curves — never voxel boxes.

import * as THREE from '../vendor/three.module.min.js';
import { WORLD, COLOURS } from './config.js';

// A radial glow sprite texture, shared by every neon sign and lamp.
let glowTexture = null;
export function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

function makeGlowSprite(color, scale) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}

// A facade texture: dark glass with a grid of lit windows.
function makeWindowTexture(rng, rows, cols, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a3648';
  g.fillRect(0, 0, 128, 256);
  const cw = 128 / cols;
  const ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (rng.next() < litRatio) {
        const warm = rng.next() < 0.7;
        g.fillStyle = warm ? '#ffd98a' : '#9fd8ff';
        g.globalAlpha = 0.55 + rng.next() * 0.45;
      } else {
        g.fillStyle = '#1b2a3d';
        g.globalAlpha = 1;
      }
      g.fillRect(col * cw + 2, r * ch + 3, cw - 4, ch - 6);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A neon sign texture with big glowing letters.
function makeNeonTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(8,8,16,0.92)';
  g.fillRect(0, 0, 512, 128);
  g.font = 'bold 84px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 28;
  g.fillStyle = color;
  g.fillText(text, 256, 66);
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The ground: one 2048px canvas holding the whole street grid.
function makeGroundTexture() {
  const S = 2048;
  const half = WORLD.half;
  const px = S / (half * 2); // pixels per world unit
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const X = (wx) => (wx + half) * px;
  const Z = (wz) => (wz + half) * px;

  // Base: sidewalk grey.
  g.fillStyle = '#3a3d47';
  g.fillRect(0, 0, S, S);
  // Park block.
  g.fillStyle = '#2e5d3a';
  g.fillRect(X(-100), Z(-60), 40 * px, 40 * px);
  // Beach strip and water at the south edge.
  g.fillStyle = '#c9b083';
  g.fillRect(0, Z(WORLD.beachZ), S, S - Z(WORLD.beachZ));
  g.fillStyle = '#0e4d6e';
  g.fillRect(0, Z(192), S, S - Z(192));
  // Roads: dark asphalt strips on every street.
  g.fillStyle = '#23252e';
  for (let s = -half; s <= half; s += WORLD.streetSpacing) {
    g.fillRect(X(s - WORLD.streetWidth / 2), 0, WORLD.streetWidth * px, S);
    g.fillRect(0, Z(s - WORLD.streetWidth / 2), S, WORLD.streetWidth * px);
  }
  // Centre dashes.
  g.fillStyle = '#d8d8c8';
  for (let s = -half; s <= half; s += WORLD.streetSpacing) {
    for (let d = -half + 10; d < half - 10; d += 20) {
      g.fillRect(X(s - 0.4), Z(d), 0.8 * px, 8 * px);
      g.fillRect(X(d), Z(s - 0.4), 8 * px, 0.8 * px);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(230,230,220,0.85)';
  for (let sx = -half; sx <= half; sx += WORLD.streetSpacing) {
    for (let sz = -half; sz <= half; sz += WORLD.streetSpacing) {
      for (let i = -2; i <= 2; i++) {
        g.fillRect(X(sx + i * 2 - 0.8), Z(sz - WORLD.streetWidth / 2), 1.6 * px, 3 * px);
        g.fillRect(X(sx + i * 2 - 0.8), Z(sz + WORLD.streetWidth / 2 - 3), 1.6 * px, 3 * px);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Four tower types, all smooth geometry in block centres.
function buildTower(scene, rng, cx, cz, kind, height, mats, colliders, glowSprites, neonSigns) {
  const group = new THREE.Group();
  const base = mats[rng.int(0, mats.length - 1)];
  const h = height;
  const w = rng.range(13, 18);
  const d = rng.range(13, 18);
  let topY = 0;
  if (kind === 0) {
    // Slab + setback + pyramid roof.
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.72, d), base);
    slab.position.y = h * 0.36;
    group.add(slab);
    const setback = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, h * 0.28, d * 0.62), base);
    setback.position.y = h * 0.72 + h * 0.14;
    group.add(setback);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.5, h * 0.16, 4), new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.6, metalness: 0.3 }));
    roof.position.y = h + h * 0.08;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    topY = h + h * 0.16;
  } else if (kind === 1) {
    // Smooth cylinder tower + spire.
    const radius = w * 0.5;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, h, 24), base);
    tower.position.y = h / 2;
    group.add(tower);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.22, h * 0.3, 12), new THREE.MeshStandardMaterial({ color: 0x39404f, roughness: 0.4, metalness: 0.6 }));
    spire.position.y = h + h * 0.15;
    group.add(spire);
    const beacon = makeGlowSprite(0xff4444, 6);
    beacon.position.y = h + h * 0.3;
    group.add(beacon);
    glowSprites.push(beacon);
    topY = h + h * 0.3;
  } else if (kind === 2) {
    // Podium + slim tower.
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w * 1.35, h * 0.22, d * 1.35), base);
    podium.position.y = h * 0.11;
    group.add(podium);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, h * 0.78, d * 0.55), base);
    tower.position.y = h * 0.22 + h * 0.39;
    group.add(tower);
    topY = h;
  } else {
    // Twin towers + skybridge with a neon strip.
    const tw = w * 0.42;
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(tw, h, tw), base);
    t1.position.set(-w * 0.3, h / 2, 0);
    group.add(t1);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(tw, h * 0.86, tw), base);
    t2.position.set(w * 0.3, h * 0.43, 0);
    group.add(t2);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 2.2, 3), new THREE.MeshStandardMaterial({ color: 0x222633, roughness: 0.4, metalness: 0.5, emissive: COLOURS.neonCyan, emissiveIntensity: 0.7 }));
    bridge.position.set(0, h * 0.78, 0);
    group.add(bridge);
    const glow = makeGlowSprite(COLOURS.neonCyan, 10);
    glow.position.set(0, h * 0.78, 0);
    group.add(glow);
    glowSprites.push(glow);
    topY = h;
  }
  group.position.set(cx, 0, cz);
  scene.add(group);
  colliders.push({ minX: cx - w * 0.75, maxX: cx + w * 0.75, minZ: cz - d * 0.75, maxZ: cz + d * 0.75 });
  return topY;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const glowSprites = [];
  const neonSigns = [];
  const windowMats = [];
  for (let i = 0; i < 3; i++) {
    const tex = makeWindowTexture(rng, 14, 6, 0.55);
    windowMats.push(new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.55,
    }));
  }

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.92, metalness: 0.05 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Sun, sky fill and the few real lights (glow sprites do the rest).
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.4);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3230, 0.85);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fb4ff, 0.0);
  moon.position.set(-80, 160, -100);
  scene.add(moon);

  // Towers in block centres. Downtown (near 0,0) is tallest.
  const blocks = [];
  for (let bx = -180; bx <= 180; bx += 40) {
    for (let bz = -180; bz <= 180; bz += 40) {
      blocks.push([bx, bz]);
    }
  }
  const openBlocks = new Set(['-80,-40', '0,0', '-120,120', '-120,-120', '120,-120', '40,40', '0,180', '80,40', '120,160', '-180,180', '0,160', '80,160', '-40,180', '40,180']);
  for (const [bx, bz] of blocks) {
    if (openBlocks.has(`${bx},${bz}`)) continue;
    if (bz >= 160) continue; // beach strip
    const dist = Math.hypot(bx, bz);
    const height = dist < 70 ? rng.range(42, 78) : dist < 130 ? rng.range(24, 48) : rng.range(14, 30);
    const kind = rng.int(0, 3);
    buildTower(scene, rng, bx, bz, kind, height, windowMats, colliders, glowSprites, neonSigns);
  }

  // Neon signs on downtown facades.
  const signs = [
    { text: 'NEON', color: '#00e5ff', x: 0, y: 34, z: -22, ry: 0 },
    { text: 'CLUB', color: '#ff2ea6', x: -40, y: 28, z: 22, ry: Math.PI },
    { text: 'VICE', color: '#ffd23f', x: 40, y: 30, z: -22, ry: 0 },
    { text: 'CASINO', color: '#39ff88', x: 80, y: 24, z: 18, ry: Math.PI },
    { text: 'HOTEL', color: '#ff7a1a', x: -80, y: 26, z: 62, ry: Math.PI },
  ];
  for (const s of signs) {
    const tex = makeNeonTexture(s.text, s.color);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 5.5), mat);
    sign.position.set(s.x, s.y, s.z);
    sign.rotation.y = s.ry;
    scene.add(sign);
    neonSigns.push(sign);
    const glow = makeGlowSprite(new THREE.Color(s.color), 16);
    glow.position.set(s.x, s.y, s.z + (s.ry === 0 ? 2 : -2));
    scene.add(glow);
    glowSprites.push(glow);
  }

  // Streetlights at every other intersection: pole + glowing head.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c2f38, roughness: 0.6, metalness: 0.7 });
  const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.2 });
  for (let sx = -200; sx <= 200; sx += 40) {
    for (let sz = -200; sz <= 200; sz += 40) {
      if (((sx + sz) / 40) % 2 !== 0) continue;
      if (sz >= 160) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 8), lampMat);
      pole.position.set(sx + 6, 3.5, sz + 6);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), lampHeadMat);
      head.position.set(sx + 6, 7.1, sz + 6);
      scene.add(head);
      const glow = makeGlowSprite(0xffe9a0, 5);
      glow.position.set(sx + 6, 7.1, sz + 6);
      scene.add(glow);
      glowSprites.push(glow);
    }
  }

  // Marina: water, yachts, boardwalk.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 24),
    new THREE.MeshStandardMaterial({ color: COLOURS.water, roughness: 0.15, metalness: 0.65 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.05, 192);
  scene.add(water);
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(400, 0.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a6b45, roughness: 0.9 }),
  );
  boardwalk.position.set(0, 0.2, 176);
  scene.add(boardwalk);
  // Yachts: curved hulls, a mast and a sail.
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.35, metalness: 0.2 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const y = new THREE.Group();
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-6, 0);
    hullShape.quadraticCurveTo(-6, 2.2, -2, 2.2);
    hullShape.lineTo(4, 2.2);
    hullShape.quadraticCurveTo(7, 1.2, 6, 0);
    hullShape.lineTo(-6, 0);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 2.6, bevelEnabled: true, bevelThickness: 0.4, bevelSize: 0.4, bevelSegments: 2 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.y = Math.PI / 2;
    hull.position.y = 0.2;
    y.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 8), lampMat);
    mast.position.set(0, 6, 0);
    y.add(mast);
    const sail = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 2.5, 0),
      new THREE.Vector3(0, 10, 0),
      new THREE.Vector3(0, 2.5, 3.2),
    ]), sailMat);
    sail.geometry.computeVertexNormals();
    y.add(sail);
    y.position.set(-140 + i * 70, 0, 188);
    y.rotation.y = rng.range(-0.3, 0.3);
    scene.add(y);
  }

  // Park: trees, paths, benches.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d44, roughness: 0.85 });
  for (let i = 0; i < 12; i++) {
    const tx = -98 + rng.range(0, 36);
    const tz = -58 + rng.range(0, 36);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3.5, 8), trunkMat);
    trunk.position.set(tx, 1.75, tz);
    trunk.castShadow = true;
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(rng.range(2.2, 3.4), 12, 10), leafMat);
    leaves.position.set(tx, 4.6, tz);
    leaves.castShadow = true;
    scene.add(leaves);
    colliders.push({ minX: tx - 0.6, maxX: tx + 0.6, minZ: tz - 0.6, maxZ: tz + 0.6 });
  }

  // Lighthouse on the point, with a sweeping beam.
  const stripeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#c22e2e';
    g.fillRect(0, 32, 64, 32);
    g.fillRect(0, 96, 64, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();
  const lighthouse = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.2, 26, 16),
    new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }),
  );
  lighthouse.position.set(-180, 13, 180);
  lighthouse.castShadow = true;
  scene.add(lighthouse);
  const lampRoom = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff2b0, emissiveIntensity: 1.5 }),
  );
  lampRoom.position.set(-180, 27.5, 180);
  scene.add(lampRoom);
  const beamGlow = makeGlowSprite(0xfff2b0, 14);
  beamGlow.position.set(-180, 27.5, 180);
  scene.add(beamGlow);
  glowSprites.push(beamGlow);
  colliders.push({ minX: -185, maxX: -175, minZ: 175, maxZ: 185 });

  // The streets, for traffic and pedestrians: coordinates of street centrelines.
  const streets = [];
  for (let s = -200; s <= 200; s += 40) streets.push(s);

  function setNight(isNight) {
    sun.intensity = isNight ? 0.12 : 2.4;
    sun.color.setHex(isNight ? 0x8fb4ff : 0xffe8c0);
    moon.intensity = isNight ? 0.7 : 0.0;
    hemi.intensity = isNight ? 0.35 : 0.85;
    for (const m of windowMats) m.emissiveIntensity = isNight ? 1.15 : 0.12;
    for (const s of glowSprites) s.material.opacity = isNight ? 0.95 : 0.35;
    scene.background = new THREE.Color(isNight ? 0x070a18 : 0x87b5d6);
    scene.fog = new THREE.Fog(isNight ? 0x0a0e22 : 0x9fc3dd, 160, 520);
  }

  return { colliders, streets, setNight, sun, glowSprites };
}
