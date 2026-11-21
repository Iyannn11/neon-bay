// Neon Bay — the city itself. No flat grey boxes: stepped towers, round
// glass spires and low neon storefronts with different silhouettes, glowing
// window BANDS (never a grid of squares), roof props, street lamps with
// pools of light, palms, a marina basin, a beach and a living ocean.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { mulberry32, pick, range, rangeInt, chance } from './random.js';
import { makeGroundTexture, makeGlowTexture, makeOceanTexture, makeSignTexture } from './textures.js';

const FACADE_COLORS = [0x8a7f72, 0x6f7d8c, 0xa89a80, 0x5d6b7a, 0x9c6b52, 0x746a80, 0xff7fa8, 0xff8a3c, 0xe8b7d4];
const GLASS_COLORS = [0x2e4a5e, 0x2a4a63, 0x3a5a6e];
const BAND_COLORS = [0xffd27a, 0x7dd7ff, 0xff5a8a, 0x9df2c0];

export function buildWorld(scene) {
  const rng = mulberry32(1337);
  const world = {
    colliders: [],
    lamps: [],
    antennas: [],
    trafficLights: [],
    update: null,
    spawn: { x: 0, z: 14 },
    shopPos: { x: -70, z: -70 },
    wardrobePos: { x: 70, z: -70 },
    taxiStand: { x: 0, z: -52 },
    beachBar: { x: 222, z: 60 },
    marina: { x: 200, z: 140 },
    photoSpots: [
      { x: 0, z: 0, name: 'Plaza' },
      { x: 222, z: 60, name: 'Beach Bar' },
      { x: 200, z: 140, name: 'Marina' },
      { x: 180, z: -120, name: 'Highway' },
    ],
    crates: [],
  };

  // Shared materials (few materials = few state changes = fast).
  const facadeMats = FACADE_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.05 }));
  const glassMats = GLASS_COLORS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.55 }));
  const bandMats = BAND_COLORS.map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.9 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.95 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.35, metalness: 0.8 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.9 });
  const glowTex = makeGlowTexture();

  function addCollider(cx, cz, hw, hd) {
    world.colliders.push({ minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd });
  }

  function glowSprite(x, y, z, color, scale) {
    const m = new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const s = new THREE.Sprite(m);
    s.position.set(x, y, z);
    s.scale.set(scale, scale, 1);
    s.name = 'glowSprite';
    scene.add(s);
    return s;
  }

  function neonSign(text, color, x, y, z, rotY, w = 14) {
    const tex = makeSignTexture(text, color);
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.name = 'neonSign';
    scene.add(mesh);
    glowSprite(x, y, z, color, w * 1.1);
    return mesh;
  }

  // ---- Ground: one big textured plane (asphalt, markings, plaza, sand).
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.worldSize, CONFIG.worldSize),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(CONFIG.worldSize, CONFIG), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);

  // ---- Ocean: animated water east of the beach, with foam at the edge.
  // The plane covers ONLY the water strip (x 264..320); a wider plane
  // would flood the beach, the marina and the eastern city.
  const oceanTex = makeOceanTexture();
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(56, CONFIG.worldSize),
    new THREE.MeshStandardMaterial({ map: oceanTex, roughness: 0.35, metalness: 0.15, color: 0x9fd4ff }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(292, 0.15, 0);
  ocean.name = 'ocean';
  scene.add(ocean);

  const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(6, CONFIG.worldSize), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(CONFIG.oceanX - 2, 0.25, 0);
  foam.name = 'foam';
  scene.add(foam);

  // ---- Buildings: varied silhouettes, glowing window bands, roof props.
  function windowBand(w, d, y, mat) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.55, d + 0.35), mat);
    band.position.y = y;
    return band;
  }

  function roofProps(group, w, d, topY, rngLocal) {
    // AC boxes.
    for (let i = 0; i < 2; i++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.6), roofMat);
      ac.position.set(range(rngLocal, -w / 4, w / 4), topY + 0.5, range(rngLocal, -d / 4, d / 4));
      group.add(ac);
    }
    // Rooftop water tank (cylinder + cone cap) on some roofs.
    if (chance(rngLocal, 0.45)) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 10), woodMat);
      tank.position.set(-w / 4, topY + 1.3, d / 4);
      group.add(tank);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.1, 10), roofMat);
      cap.position.set(-w / 4, topY + 3.1, d / 4);
      group.add(cap);
      for (const [lx, lz] of [[-w / 4 - 1.2, d / 4 - 1.2], [-w / 4 + 1.2, d / 4 - 1.2], [-w / 4 - 1.2, d / 4 + 1.2], [-w / 4 + 1.2, d / 4 + 1.2]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.2, 0.22), steelMat);
        leg.position.set(lx, topY + 0.6, lz);
        group.add(leg);
      }
    }
    // Antenna with a blinking red tip.
    if (chance(rngLocal, 0.6)) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 7, 6), steelMat);
      ant.position.set(w / 4, topY + 3.5, -d / 4);
      group.add(ant);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }),
      );
      tip.position.set(w / 4, topY + 7.2, -d / 4);
      group.add(tip);
      world.antennas.push(tip);
    }
  }

  function steppedTower(cx, cz, rngLocal) {
    const group = new THREE.Group();
    const w = range(rngLocal, 20, 26), d = range(rngLocal, 18, 24);
    const tiers = chance(rngLocal, 0.4) ? 4 : 3;
    let y = 0;
    let topW = w, topD = d;
    const facadeA = pick(rngLocal, facadeMats);
    const facadeB = pick(rngLocal, facadeMats);
    for (let t = 0; t < tiers; t++) {
      const tw = w * (1 - t * 0.2), td = d * (1 - t * 0.2);
      const th = range(rngLocal, 10, 20);
      // Alternate facade tone per tier so the tower is not one flat slab.
      const facade = t % 2 === 0 ? facadeA : facadeB;
      const tier = new THREE.Mesh(new THREE.BoxGeometry(tw, th, td), facade);
      tier.position.y = y + th / 2;
      tier.castShadow = true;
      tier.receiveShadow = true;
      group.add(tier);
      // Cornice ledge at the top of every tier (a setback shadow line).
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(tw + 0.5, 0.35, td + 0.5), roofMat);
      ledge.position.y = y + th - 0.2;
      group.add(ledge);
      // Corner columns: vertical rhythm down each tier's corners.
      for (const [ccx, ccz] of [[-tw / 2, -td / 2], [tw / 2, -td / 2], [-tw / 2, td / 2], [tw / 2, td / 2]]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, th, 0.6), facadeB);
        col.position.set(ccx, y + th / 2, ccz);
        group.add(col);
      }
      // Inset window columns: dark glass strips on the front and sides,
      // between the glowing bands — never a flat wall.
      for (const wx of [-tw / 4, 0, tw / 4]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, th * 0.55, 0.12), pick(rngLocal, glassMats));
        win.position.set(wx, y + th * 0.42, td / 2 + 0.06);
        group.add(win);
      }
      for (const wz of [-td / 4, td / 4]) {
        for (const sx of [-tw / 2 - 0.06, tw / 2 + 0.06]) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.12, th * 0.55, 1.1), pick(rngLocal, glassMats));
          win.position.set(sx, y + th * 0.42, wz);
          group.add(win);
        }
      }
      // Glowing window bands: two lit strips per tier, never a grid.
      const bandMat = pick(rngLocal, bandMats);
      for (const by of [y + th * 0.35, y + th * 0.75]) {
        const band = windowBand(tw, td, by, bandMat);
        group.add(band);
      }
      // A darker glass crown on the tier's top edge.
      const crown = new THREE.Mesh(new THREE.BoxGeometry(tw + 0.2, 0.8, td + 0.2), pick(rngLocal, glassMats));
      crown.position.y = y + th - 0.4;
      group.add(crown);
      // Balconies on EVERY tier's front face: slab + railing.
      for (const bx of [-tw / 4, tw / 4]) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.3, 1.6), roofMat);
        slab.position.set(bx, y + th - 2.4, td / 2 + 0.7);
        group.add(slab);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1, 0.12), pick(rngLocal, glassMats));
        rail.position.set(bx, y + th - 1.75, td / 2 + 1.4);
        group.add(rail);
        const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.2), pick(rngLocal, glassMats));
        door.position.set(bx, y + th - 1.4, td / 2 + 0.1);
        group.add(door);
      }
      topW = tw; topD = td;
      y += th;
    }
    // Neon name sign on the top tier (some towers): the facade gets a name.
    if (chance(rngLocal, 0.45)) {
      const names = ['HOTEL', 'VISTA', 'TOWER', 'PLAZA', 'NEON', 'APEX'];
      const nm = pick(rngLocal, names);
      const nc = pick(rngLocal, ['#ff2d78', '#7dd7ff', '#ffd23e', '#ff9a3c']);
      neonSign(nm, nc, cx, y + 2.5, cz + topD / 2 + 0.3, 0, 11);
    }
    roofProps(group, w, d, y, rngLocal);
    group.position.set(cx, 0, cz);
    scene.add(group);
    addCollider(cx, cz, w / 2 + 0.5, d / 2 + 0.5);
    return y;
  }

  function roundTower(cx, cz, rngLocal) {
    const group = new THREE.Group();
    const r = range(rngLocal, 9, 12);
    const h = range(rngLocal, 34, 52);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.08, h, 20),
      pick(rngLocal, glassMats),
    );
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Vertical fins so the cylinder is not a plain tube.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, h * 0.92, 1.1), pick(rngLocal, facadeMats));
      fin.position.set(Math.cos(a) * (r + 0.2), h / 2, Math.sin(a) * (r + 0.2));
      fin.rotation.y = -a;
      group.add(fin);
    }
    // Lit bands ringing the tower.
    const bandMat = pick(rngLocal, bandMats);
    for (const by of [h * 0.3, h * 0.62, h * 0.9]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.25, 0.32, 6, 28), bandMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = by;
      group.add(ring);
    }
    // Rounded cap.
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.92, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), pick(rngLocal, facadeMats));
    cap.position.y = h;
    group.add(cap);
    roofProps(group, r * 2, r * 2, h + r * 0.5, rngLocal);
    group.position.set(cx, 0, cz);
    scene.add(group);
    addCollider(cx, cz, r + 0.5, r + 0.5);
    return h;
  }

  // Full-glass tower: a sheer glass slab with dark mullion strips, a
  // glowing crown ring and a spire — a completely different silhouette.
  function glassTower(cx, cz, rngLocal) {
    const group = new THREE.Group();
    const w = range(rngLocal, 14, 20), d = range(rngLocal, 12, 16);
    const h = range(rngLocal, 40, 62);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: pick(rngLocal, GLASS_COLORS), roughness: 0.12, metalness: 0.75 }),
    );
    body.position.y = h / 2;
    body.castShadow = true;
    group.add(body);
    // Dark vertical mullions down every face.
    for (let i = 0; i < 5; i++) {
      const x = -w / 2 + (i + 0.5) * (w / 5);
      for (const z of [-d / 2 - 0.06, d / 2 + 0.06]) {
        const mull = new THREE.Mesh(new THREE.BoxGeometry(0.35, h * 0.96, 0.12), darkMat);
        mull.position.set(x, h / 2, z);
        group.add(mull);
      }
    }
    // Glowing crown ring + spire on top.
    const crownMat = pick(rngLocal, bandMats);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6), crownMat);
    ring.position.y = h - 0.4;
    group.add(ring);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 9, 6), steelMat);
    spire.position.y = h + 4.5;
    group.add(spire);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    tip.position.y = h + 9.2;
    group.add(tip);
    world.antennas.push(tip);
    // A mid-height glowing band so the glass reads at night.
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.6, d + 0.3), crownMat);
    band.position.y = h * 0.55;
    group.add(band);
    roofProps(group, w, d, h, rngLocal);
    group.position.set(cx, 0, cz);
    scene.add(group);
    addCollider(cx, cz, w / 2 + 0.5, d / 2 + 0.5);
    return h;
  }

  function lowBlock(cx, cz, rngLocal, signText, signColor) {
    const group = new THREE.Group();
    const w = range(rngLocal, 22, 30), d = range(rngLocal, 14, 20);
    const h = range(rngLocal, 7, 11);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pick(rngLocal, facadeMats));
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    // Glass storefront band along the front.
    const store = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 2.6, 0.4), pick(rngLocal, glassMats));
    store.position.set(0, 2.2, d / 2 + 0.15);
    group.add(store);
    // Awning: striped canopy over the storefront.
    const awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.25, 3), new THREE.MeshStandardMaterial({ color: signColor || 0xff2d78, roughness: 0.8 }));
    awn.position.set(0, 4.4, d / 2 + 1.4);
    awn.rotation.x = 0.25;
    group.add(awn);
    // Neon sign above the awning (absolute world coords: the sign is
    // added to the scene, not the group).
    if (signText) {
      neonSign(signText, signColor || '#ff2d78', cx, h + 2.2, cz + d / 2 + 0.3, 0, 13);
    }
    // Billboard on the roof: two posts + a big glowing board.
    if (signText && chance(rngLocal, 0.55)) {
      const boardTexts = ['VICE CITY', 'NEON BAY', 'GTA VI', 'PALM BEACH', 'SUNSET STRIP'];
      const boardText = pick(rngLocal, boardTexts);
      for (const px of [-5, 5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 5, 6), steelMat);
        post.position.set(px, h + 2.5, 0);
        group.add(post);
      }
      const tex = makeSignTexture(boardText, signColor || '#ff2d78');
      const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: tex }));
      board.position.set(0, h + 7, 0);
      group.add(board);
      glowSprite(cx, h + 7, cz + 1, signColor || '#ff2d78', 12);
    }
    group.position.set(cx, 0, cz);
    scene.add(group);
    addCollider(cx, cz, w / 2 + 0.5, d / 2 + 0.5);
    return h;
  }

  // Lay out the city: one or two buildings per block, skipping the plaza,
  // the beach strip and the marina basin.
  const signs = [
    ['HOTEL', '#7dd7ff'], ['CASINO', '#ffd23e'], ['NEON BAY', '#ff2d78'],
    ['TACOS', '#ff9a3c'], ['CLUB VICE', '#c06bff'], ['PIZZA', '#9df2c0'],
  ];
  let signIdx = 0;
  let tallest = { h: 0, x: 0, z: 0 };
  for (let bx = -3; bx <= 3; bx++) {
    for (let bz = -3; bz <= 3; bz++) {
      const cx = bx * CONFIG.blockSize;
      const cz = bz * CONFIG.blockSize;
      if (Math.abs(cx) < CONFIG.plaza.half + 30 && Math.abs(cz) < CONFIG.plaza.half + 30) continue; // plaza
      if (cx > 200) continue; // beach / marina
      if (cx > 150 && cz > 100) continue; // marina basin
      const roll = rng();
      let h = 0;
      if (roll < 0.38) {
        h = steppedTower(cx, cz, rng);
      } else if (roll < 0.56) {
        h = roundTower(cx, cz, rng);
      } else if (roll < 0.68) {
        h = glassTower(cx, cz, rng);
      } else {
        const s = signs[signIdx % signs.length];
        signIdx++;
        h = lowBlock(cx, cz, rng, s[0], s[1]);
        // A second small shop on the block corner.
        if (chance(rng, 0.5)) {
          lowBlock(cx + 18, cz + 14, rng, null, null);
        }
      }
      if (h > tallest.h) tallest = { h, x: cx, z: cz };
    }
  }

  // Helipad on the tallest tower.
  {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.5, 20), darkMat);
    pad.position.set(tallest.x, tallest.h + 0.3, tallest.z);
    scene.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.35, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(tallest.x, tallest.h + 0.6, tallest.z);
    scene.add(ring);
  }

  // ---- Marina basin: water, docks, boats, containers.
  {
    const basin = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 70),
      new THREE.MeshStandardMaterial({ map: oceanTex, roughness: 0.3, metalness: 0.2, color: 0x9fd4ff }),
    );
    basin.rotation.x = -Math.PI / 2;
    basin.position.set(200, 0.2, 140);
    basin.name = 'marinaBasin';
    scene.add(basin);
    // Wooden docks.
    for (const dz of [112, 140, 168]) {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(100, 0.6, 4), woodMat);
      dock.position.set(200, 0.5, dz);
      dock.castShadow = true;
      scene.add(dock);
    }
    // Boats: hull + cabin + mast, in different colours.
    const boatColors = [0xffffff, 0xff5a3c, 0x2d9bff, 0xffd23e];
    for (let i = 0; i < 4; i++) {
      const bg = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 3.4), new THREE.MeshStandardMaterial({ color: boatColors[i], roughness: 0.5 }));
      hull.position.y = 0.8;
      bg.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.4, 4), hull.material);
      bow.rotation.z = -Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(7.4, 0.8, 0);
      bg.add(bow);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(4, 1.8, 2.6), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 }));
      cabin.position.set(-1, 2.4, 0);
      bg.add(cabin);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), steelMat);
      mast.position.set(1.5, 5, 0);
      bg.add(mast);
      bg.position.set(170 + i * 20, 0.2, 126 + (i % 2) * 28);
      bg.rotation.y = (rng() - 0.5) * 0.4;
      scene.add(bg);
    }
    // Shipping containers: stacked colour blocks at the basin edge.
    const contColors = [0xd94f3d, 0x2d7dd9, 0x3da55d, 0xd9a441];
    for (let i = 0; i < 8; i++) {
      const cm = new THREE.Mesh(
        new THREE.BoxGeometry(6, 2.6, 2.6),
        new THREE.MeshStandardMaterial({ color: contColors[i % 4], roughness: 0.7, metalness: 0.3 }),
      );
      cm.position.set(150 + (i % 4) * 7, 1.3 + Math.floor(i / 4) * 2.7, 108);
      cm.castShadow = true;
      scene.add(cm);
      if (i < 4) addCollider(150 + i * 7, 108, 3.2, 1.5);
    }
  }

  // ---- Beach bar hut with a striped awning and a sign.
  {
    const hut = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 7), woodMat);
    base.position.y = 2.5;
    base.castShadow = true;
    hut.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 3, 4), new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.9 }));
    roof.position.y = 6.5;
    roof.rotation.y = Math.PI / 4;
    hut.add(roof);
    hut.position.set(world.beachBar.x, 0, world.beachBar.z);
    scene.add(hut);
    neonSign('BEACH BAR', '#ffd23e', world.beachBar.x, 8.5, world.beachBar.z + 4, 0, 10);
    addCollider(world.beachBar.x, world.beachBar.z, 5.5, 4);
  }

  // ---- Beach umbrellas + towels on the sand so the beach reads as a
  // beach, not an empty desert.
  for (const [x, z, color] of [[250, 8, 0xff2d78], [250, 70, 0x2d9bff], [240, 110, 0xffd23e]]) {
    const umb = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6), steelMat);
    pole.position.y = 1.7;
    umb.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 8), new THREE.MeshStandardMaterial({ color, roughness: 0.8, side: THREE.DoubleSide }));
    canopy.position.y = 3.6;
    umb.add(canopy);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
    towel.position.set(2.6, 0.1, 0.8);
    towel.rotation.y = 0.5;
    umb.add(towel);
    const towel2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: 0xff9a3c, roughness: 0.9 }));
    towel2.position.set(-2.4, 0.1, -0.6);
    towel2.rotation.y = -0.4;
    umb.add(towel2);
    umb.position.set(x, 0, z);
    scene.add(umb);
  }

  // ---- Shop + wardrobe storefronts (gameplay anchors).
  lowBlock(world.shopPos.x, world.shopPos.z, rng, 'AMMU-NATION', '#ff5a3c');
  lowBlock(world.wardrobePos.x, world.wardrobePos.z, rng, 'THREADS', '#7dd7ff');

  // ---- Street lamps along the roads, with pools of light.
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x22262c, roughness: 0.6, metalness: 0.6 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const poolTex = makeGlowTexture('rgba(255,210,140,0.9)', 'rgba(255,210,140,0)');
  for (let i = -3; i <= 3; i++) {
    for (const z of [-96, -32, 32, 96]) {
      const x = i * CONFIG.blockSize + CONFIG.roadWidth / 2 + 1;
      if (Math.abs(x) > 200) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), lampPoleMat);
      pole.position.set(x, 3.5, z);
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.6), lampHeadMat);
      head.position.set(x, 7, z);
      scene.add(head);
      const pool = new THREE.Mesh(
        new THREE.CircleGeometry(6, 20),
        new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.3, z);
      scene.add(pool);
      world.lamps.push({ pool, head });
    }
  }

  // ---- Palms along the beach and plaza.
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 7), new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.95 }));
    trunk.position.y = 3.5;
    trunk.rotation.z = (rng() - 0.5) * 0.16;
    g.add(trunk);
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d46, roughness: 0.85, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5.5, 4), frondMat);
      const a = (i / 7) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 1.8, 7.6, Math.sin(a) * 1.8);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      frond.scale.set(1, 1, 0.25);
      g.add(frond);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    addCollider(x, z, 0.6, 0.6);
  }
  for (let z = -240; z <= 240; z += 40) palm(242, z + (rng() - 0.5) * 8);
  for (const [x, z] of [[-46, -46], [46, -46], [-46, 46], [46, 46], [-30, 30], [30, -30]]) palm(x, z);

  // ---- Traffic lights at the four plaza corners.
  for (const [x, z] of [[-52, -52], [52, -52], [-52, 52], [52, 52]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5, 6), lampPoleMat);
    post.position.set(x, 2.5, z);
    scene.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), darkMat);
    box.position.set(x, 5.6, z);
    scene.add(box);
    const red = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(x, 6.1, z + 0.4);
    scene.add(red);
    const green = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x224422 }));
    green.position.set(x, 5.3, z + 0.4);
    scene.add(green);
    world.trafficLights.push({ red, green, state: 'green' });
  }

  // ---- 3D curbs around the plaza and the beachfront road.
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.85 });
  for (const [x, z, w, d] of [
    [0, -42.5, 88, 1], [0, 42.5, 88, 1], [-42.5, 0, 1, 88], [42.5, 0, 1, 88],
    [216, 50, 1.2, 220],
  ]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), curbMat);
    curb.position.set(x, 0.15, z);
    scene.add(curb);
  }

  // ---- Benches around the plaza fountain (seated NPCs use these spots).
  function bench(x, z, rotY) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 1), woodMat);
    seat.position.y = 0.55;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.2), woodMat);
    back.position.set(0, 1.1, -0.45);
    g.add(back);
    for (const sx of [-1.2, 1.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.9), darkMat);
      leg.position.set(sx, 0.28, 0);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    addCollider(x, z, 1.6, 0.6);
  }
  bench(14, 14, Math.PI * 0.75);
  bench(-14, -14, -Math.PI * 0.25);
  bench(14, -14, Math.PI * 0.25);
  bench(-14, 14, -Math.PI * 0.75);

  // ---- Bus stops: shelter posts + roof + bench, at two roadside spots.
  for (const [x, z, rotY] of [[68, -96, 0], [-68, 96, Math.PI]]) {
    const g = new THREE.Group();
    for (const px of [-2.4, 2.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 6), steelMat);
      post.position.set(px, 1.7, 0);
      g.add(post);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 2.4), new THREE.MeshStandardMaterial({ color: 0x2d9bff, roughness: 0.5, metalness: 0.3 }));
    roof.position.y = 3.5;
    g.add(roof);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.25, 0.9), woodMat);
    seat.position.y = 0.55;
    g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 0.15), woodMat);
    back.position.set(0, 1.05, -0.4);
    g.add(back);
    neonSign('BUS STOP', '#7dd7ff', x, 4.6, z, rotY, 7);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    addCollider(x, z, 3, 1.4);
  }

  // ---- Kiosks at two plaza corners: hut + striped awning + sign.
  for (const [x, z, label, color] of [[-40, 40, 'SNACKS', '#ffd23e'], [40, -40, 'KOPI', '#ff9a3c']]) {
    const g = new THREE.Group();
    const hut = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 4), woodMat);
    hut.position.y = 1.7;
    hut.castShadow = true;
    g.add(hut);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.2, 2.2), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    awn.position.set(0, 3.6, 2.2);
    awn.rotation.x = 0.3;
    g.add(awn);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1, 1), darkMat);
    counter.position.set(0, 0.5, 2.2);
    g.add(counter);
    neonSign(label, color, x, 4.6, z + 2.6, 0, 6);
    g.position.set(x, 0, z);
    scene.add(g);
    addCollider(x, z, 2.8, 2.4);
  }

  // ---- Glowing road-edge lines: bright strips along the plaza ring and
  // the beachfront road, so roads are never a flat slab.
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  for (const [x, z, w, d] of [
    [-52, 0, 0.5, 104], [52, 0, 0.5, 104], [0, -52, 104, 0.5], [0, 52, 104, 0.5],
    [216, 50, 0.5, 220],
  ]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), edgeMat);
    strip.position.set(x, 0.32, z);
    scene.add(strip);
  }

  // ---- Plaza lamps: four more lamp posts inside the plaza ring.
  for (const [x, z] of [[30, 30], [-30, 30], [30, -30], [-30, -30]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 8), lampPoleMat);
    pole.position.set(x, 3.5, z);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.6), lampHeadMat);
    head.position.set(x, 7, z);
    scene.add(head);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(6, 20),
      new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.3, z);
    scene.add(pool);
    world.lamps.push({ pool, head });
  }

  // ---- Street name signs at four intersections: pole + glowing blade.
  for (const [x, z, label] of [[70, 58, 'OCEAN DR'], [-70, -58, 'PALM AVE'], [70, -58, 'VICE ST'], [-70, 58, 'SUNSET BLVD']]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.4, 6), lampPoleMat);
    pole.position.set(x, 1.7, z);
    scene.add(pole);
    const tex = makeSignTexture(label, '#7dd7ff');
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: tex }));
    blade.position.set(x, 3.6, z);
    scene.add(blade);
    glowSprite(x, 3.6, z, 0x7dd7ff, 4);
  }

  // ---- More benches: marina + beachfront.
  bench(170, 100, 0.6);
  bench(230, 178, -0.4);
  bench(222, -20, Math.PI / 2);
  bench(222, 100, Math.PI / 2);

  // ---- More palms along the beachfront road.
  for (const z of [-80, 0, 140]) palm(216, z);

  // ---- Neon crates (collectibles): glowing pink cubes on posts.
  const crateSpots = [
    [40, 40], [-80, 30], [90, -100], [-140, -60], [120, 90], [-40, 150],
    [170, -40], [-170, 120], [60, 170], [210, 10],
  ];
  for (const [x, z] of crateSpots) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xff2d78, emissive: 0xff2d78, emissiveIntensity: 0.9, roughness: 0.3 }),
    );
    crate.position.set(x, 1.6, z);
    crate.name = 'neonCrate';
    scene.add(crate);
    glowSprite(x, 1.6, z, 0xff2d78, 5);
    world.crates.push({ mesh: crate, x, z, taken: false });
  }

  // ---- Plaza fountain: a round basin with a glowing centre column.
  {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 1.2, 24), new THREE.MeshStandardMaterial({ color: 0x8d9299, roughness: 0.8 }));
    basin.position.set(0, 0.6, 0);
    basin.receiveShadow = true;
    scene.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(8.4, 24), new THREE.MeshStandardMaterial({ color: 0x2d9bff, roughness: 0.15, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 1.25, 0);
    scene.add(water);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 5, 12), new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.4 }));
    column.position.set(0, 3.5, 0);
    scene.add(column);
    glowSprite(0, 6.5, 0, 0x7dd7ff, 9);
    addCollider(0, 0, 10, 10);
  }

  // ---- Per-frame world life: ocean scroll, foam pulse, blinking antennas,
  // traffic-light cycle, lamp pools by time of day.
  let lightTimer = 0;
  world.update = (dt, elapsed, timeOfDay) => {
    oceanTex.offset.x += dt * 0.008;
    oceanTex.offset.y += dt * 0.003;
    foamMat.opacity = 0.3 + Math.sin(elapsed * 1.4) * 0.12;
    const blink = Math.sin(elapsed * 3) > 0;
    for (const a of world.antennas) a.material.color.setHex(blink ? 0xff2222 : 0x441111);
    lightTimer += dt;
    if (lightTimer > 6) {
      lightTimer = 0;
      for (const tl of world.trafficLights) {
        tl.state = tl.state === 'green' ? 'red' : 'green';
        tl.red.material.color.setHex(tl.state === 'red' ? 0xff2222 : 0x441111);
        tl.green.material.color.setHex(tl.state === 'green' ? 0x2ee66b : 0x113311);
      }
    }
    const nightBoost = timeOfDay === 'night' ? 0.55 : 0.22;
    for (const l of world.lamps) l.pool.material.opacity = nightBoost;
  };

  return world;
}
