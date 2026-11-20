// Neon Bay — procedural sun-soaked coastal city.
// Builds the ground, road grid, buildings, beach, ocean, palms, neon signs,
// streetlights and landmarks from a seeded generator, so the same seed
// always grows the same city. Also owns the day/night lighting switch and
// the traffic-light phases the traffic AI obeys.

import * as THREE from 'three';
import { WORLD, COLOURS } from './config.js';
import { pick, range, rangeInt } from './random.js';

function makeWindowTexture(rng, litRatio) {
  // Light facade so sun-soaked buildings read as pastel, not black: the
  // material colour tints this texture, dark windows stay dark, lit ones glow.
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.fillStyle = '#b8bcc4';
  g.fillRect(0, 0, 64, 128);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#20242e';
      g.fillRect(6 + col * 14, 8 + row * 15, 10, 9);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSignTexture(text, colour) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#0c0c14';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = colour;
  g.shadowColor = colour;
  g.shadowBlur = 18;
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(scene, rng) {
  const colliders = [];
  const streetlights = [];
  const neonSigns = [];
  const windowMeshes = [];
  const group = new THREE.Group();
  group.name = 'NeonBayCity';
  scene.add(group);

  // Ground: grass base, then roads and beach laid on top of it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, WORLD.groundSize),
    new THREE.MeshStandardMaterial({ color: COLOURS.grass, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: dark strips along every grid line, both directions.
  const roadMat = new THREE.MeshStandardMaterial({ color: COLOURS.asphalt, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.8 });
  for (const c of WORLD.roads) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.halfSize * 2 + 40), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(c, 0.02, 0);
    roadX.receiveShadow = true;
    group.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.halfSize * 2 + 40, WORLD.roadWidth), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, 0.02, c);
    roadZ.receiveShadow = true;
    group.add(roadZ);
    // Dashed centre lines.
    for (let t = -WORLD.halfSize; t < WORLD.halfSize; t += 16) {
      const dashX = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 7), lineMat);
      dashX.position.set(c, 0.04, t);
      group.add(dashX);
      const dashZ = new THREE.Mesh(new THREE.BoxGeometry(7, 0.05, 0.5), lineMat);
      dashZ.position.set(t, 0.04, c);
      group.add(dashZ);
    }
  }

  // Beach sand and ocean on the south edge.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, WORLD.oceanStart - WORLD.beachStart),
    new THREE.MeshStandardMaterial({ color: COLOURS.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, (WORLD.beachStart + WORLD.oceanStart) / 2);
  sand.receiveShadow = true;
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.groundSize, 90),
    new THREE.MeshStandardMaterial({ color: COLOURS.ocean, roughness: 0.35, metalness: 0.15 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.02, WORLD.oceanStart + 45);
  group.add(ocean);

  // Boardwalk along the beach.
  const boardwalk = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD.groundSize, 0.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x9c7a4d, roughness: 0.9 }),
  );
  boardwalk.position.set(0, 0.2, WORLD.beachStart - 2);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);

  // Buildings: one to three per block, heights rise toward downtown (0, 0).
  const blockCentres = [-150, -90, -30, 30, 90, 150];
  const windowTextures = [
    makeWindowTexture(rng, 0.35),
    makeWindowTexture(rng, 0.55),
    makeWindowTexture(rng, 0.2),
  ];
  const signWords = ['NEON', 'HOTEL', 'CASINO', 'PIZZA', 'TACOS', 'BAY', 'MOTEL', 'CLUB'];
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      if (bz > 180) continue;
      const distDowntown = Math.hypot(bx, bz);
      const maxHeight = distDowntown < 70 ? 95 : distDowntown < 130 ? 55 : 30;
      const count = rangeInt(rng, 1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, 14, 24);
        const d = range(rng, 14, 24);
        const h = range(rng, 10, maxHeight);
        const ox = range(rng, -12, 12);
        const oz = range(rng, -12, 12);
        const x = bx + ox;
        const z = bz + oz;
        const colour = pick(rng, COLOURS.buildingPalette);
        const winTex = pick(rng, windowTextures);
        // emissiveMap = the same window texture, so at night only the lit
        // windows glow instead of the whole facade.
        const sideMat = new THREE.MeshStandardMaterial({
          map: winTex, emissiveMap: winTex, emissive: 0x000000,
          color: colour, roughness: 0.85,
        });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 1 });
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat]);
        building.position.set(x, h / 2 + 0.3, z);
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        windowMeshes.push(sideMat);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        // Neon sign on taller downtown buildings.
        if (h > 40 && rng() < 0.6) {
          const word = pick(rng, signWords);
          const neonColour = pick(rng, COLOURS.neonPalette);
          const cssColour = `#${neonColour.toString(16).padStart(6, '0')}`;
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 4),
            new THREE.MeshBasicMaterial({ map: makeSignTexture(word, cssColour), transparent: true }),
          );
          sign.position.set(x, h * 0.82, z + d / 2 + 0.15);
          group.add(sign);
          neonSigns.push(sign.material);
        }
      }
    }
  }

  // Palm trees along the beach and a few downtown sidewalks.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e4f, roughness: 0.9 });
  function addPalm(x, z) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), trunkMat);
    trunk.position.y = 4.5;
    trunk.castShadow = true;
    palm.add(trunk);
    for (let i = 0; i < 5; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 4), leafMat);
      const angle = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 1.8, 9.2, Math.sin(angle) * 1.8);
      leaf.rotation.z = Math.cos(angle) * 0.9;
      leaf.rotation.x = -Math.sin(angle) * 0.9;
      palm.add(leaf);
    }
    palm.position.set(x, 0, z);
    group.add(palm);
  }
  for (let x = -280; x <= 280; x += 28) addPalm(x, 218);
  for (let i = 0; i < 10; i += 1) addPalm(range(rng, -190, 190), pick(rng, [-150, -90, 30, 150]) + 8);

  // Streetlights at intersections.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x30343c, roughness: 0.7, metalness: 0.5 });
  for (const rx of WORLD.roads) {
    for (const rz of WORLD.roads) {
      if ((rx + rz) % 120 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
      pole.position.set(rx + 8, 3.5, rz + 8);
      group.add(pole);
      const lampMat = new THREE.MeshStandardMaterial({
        color: 0xfff6c9, emissive: 0xffe9a0, emissiveIntensity: 0.15,
      });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
      lamp.position.set(rx + 8, 7.2, rz + 8);
      group.add(lamp);
      streetlights.push(lampMat);
    }
  }

  // Landmarks the missions use.
  function landmarkBox(x, z, w, h, d, colour, name) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 0.8 }),
    );
    mesh.position.set(x, h / 2 + 0.3, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    group.add(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }
  // Hideout: small blue-roof house in the north-west suburbs.
  const hideout = landmarkBox(-150, -150, 16, 7, 12, 0x4a7fb8, 'Hideout');
  const hideoutRoof = new THREE.Mesh(
    new THREE.ConeGeometry(11, 5, 4),
    new THREE.MeshStandardMaterial({ color: 0x2c4f7a, roughness: 0.9 }),
  );
  hideoutRoof.position.set(-150, 9.8, -150);
  hideoutRoof.rotation.y = Math.PI / 4;
  group.add(hideoutRoof);
  // Garage: yellow workshop downtown-east.
  landmarkBox(150, -30, 20, 8, 14, 0xd8a920, 'Garage');
  // Coral Bank: tall marble tower downtown.
  const bank = landmarkBox(30, 30, 24, 70, 24, 0xd8d2c0, 'CoralBank');
  const bankSign = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 4),
    new THREE.MeshBasicMaterial({ map: makeSignTexture('CORAL BANK', '#ffd400'), transparent: true }),
  );
  bankSign.position.set(30, 58, 30 + 12.2);
  group.add(bankSign);
  neonSigns.push(bankSign.material);
  // Marina crate near the beach.
  const crate = new THREE.Mesh(
    new THREE.BoxGeometry(4, 4, 4),
    new THREE.MeshStandardMaterial({ color: 0xb8642a, roughness: 0.9 }),
  );
  crate.position.set(-60, 2.3, 222);
  crate.castShadow = true;
  group.add(crate);
  // Yacht in the ocean.
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(16, 3, 5),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }),
  );
  hull.position.y = 1.5;
  yacht.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(8, 2.5, 4),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.4 }),
  );
  cabin.position.set(-1, 4, 0);
  yacht.add(cabin);
  yacht.position.set(90, 0.4, 285);
  group.add(yacht);

  const landmarks = {
    hideout: new THREE.Vector3(-150, 0, -132),
    garage: new THREE.Vector3(150, 0, -12),
    marinaCrate: new THREE.Vector3(-60, 0, 216),
    bank: new THREE.Vector3(30, 0, 14),
    yacht: new THREE.Vector3(90, 0, 272),
    downtown: new THREE.Vector3(0, 0, 0),
    beach: new THREE.Vector3(0, 0, 230),
  };

  return {
    group,
    colliders,
    landmarks,
    // Green for traffic travelling along the named axis at this crossing.
    trafficLightGreen(axis, ix, iz, time) {
      const phase = Math.floor(time / 6 + ix + iz) % 2;
      if (axis === 'ns') return phase === 0;
      return phase === 1;
    },
    setNight(isNight) {
      for (const mat of streetlights) mat.emissiveIntensity = isNight ? 2.4 : 0.15;
      for (const mat of windowMeshes) {
        mat.emissive = new THREE.Color(isNight ? 0xffb85c : 0x000000);
        mat.emissiveIntensity = isNight ? 1.1 : 0;
      }
    },
  };
}
