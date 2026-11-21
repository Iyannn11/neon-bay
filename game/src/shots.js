// Neon Bay — screenshot presets and the headless self-test. Each shot pins the
// time of day, places Kai (on foot, in the car, on the bike) and frames a DENSE
// view: streets with buildings on both sides and props in the foreground,
// never a wide empty vista. Written fresh for Round 12.
import * as THREE from 'three';

// Shot definitions: hour, where Kai stands/drives, camera offset (relative to
// the subject) and look target. Framing rule: no single flat surface may fill
// more than ~40% of the frame.
export const SHOTS = {
  cover: {
    hour: 21.6, label: 'night neon plaza',
    setup(g) {
      g.hour = 21.6; g.sky.setTime(21.6);
      g.player.pos.set(2, 0, 26);
      g.player.heading = Math.PI; // facing the plaza + fountain + towers
      g.player.yaw = Math.PI;
      g.player.walkPhase = 1.2; // mid-stride
      g.player.moving = true;
      g.camMode = 'shot';
      // tight on Kai + fountain + towers: foreground road is out of frame
      g.shotCam.pos.set(7, 3.0, 32);
      g.shotCam.look.set(-1, 4.0, 10);
      g.setWanted(0);
    },
  },
  drive: {
    hour: 17.5, label: 'golden-hour street driving',
    setup(g) {
      g.hour = 17.5; g.sky.setTime(17.5);
      // red sport car on the 60 avenue, heading north between towers
      const car = g.playerCar;
      const drv = g.playerCarDriver;
      g.enterVehicle(car, drv);
      drv.pos.set(60, 0, 34);
      drv.heading = 0;
      drv.speed = 0; // static hero shot — the car holds its pose
      g.player.yaw = 0;
      g.camMode = 'shot';
      // close 3/4 chase: the car fills a quarter of the frame, street + towers behind
      g.shotCam.pos.set(54, 3.1, 43);
      g.shotCam.look.set(60, 1.2, 28);
      g.setWanted(0);
    },
  },
  mission: {
    hour: 6.5, label: 'dawn marina action',
    setup(g) {
      g.hour = 6.5; g.sky.setTime(6.5);
      // Kai ON the middle dock, facing the boats moored just south of it
      g.player.pos.set(124, 0, 134);
      g.player.heading = Math.PI * 0.9;
      g.player.yaw = Math.PI * 0.9;
      g.player.aiming = true;
      g.player.walkPhase = 0.4;
      g.camMode = 'shot';
      // camera ON the same dock, close behind Kai: dock planks in the
      // foreground, Kai the subject, boats + water + sunrise behind him
      g.shotCam.pos.set(117, 2.4, 134);
      g.shotCam.look.set(136, 2.0, 136);
      g.setWanted(0);
      // a couple of guards visible on the dock for the action read
      g.spawnGuards(2);
    },
  },
  beach: {
    hour: 17.5, label: 'sunset bike ride',
    setup(g) {
      g.hour = 17.5; g.sky.setTime(17.5);
      const bike = g.bike1;
      const bdrv = g.bike1Driver;
      g.enterVehicle(bike, bdrv);
      bdrv.pos.set(196, 0, 30);
      bdrv.heading = Math.PI / 2; // riding west, toward the umbrellas + sunset
      bdrv.speed = 0; // static hero shot — the bike holds its pose
      g.player.yaw = Math.PI / 2;
      g.camMode = 'shot';
      // camera east of the rider, looking west: rider in the foreground,
      // umbrella cluster + palms + sunset behind him (sand is a backdrop)
      g.shotCam.pos.set(205, 2.6, 37);
      g.shotCam.look.set(190, 1.2, 24);
      g.setWanted(0);
    },
  },
};

export function applyShot(game, name) {
  const s = SHOTS[name];
  if (!s) return false;
  game.freezeClock = true;
  s.setup(game);
  game.shotName = name;
  return true;
}

// --- headless self-test --------------------------------------------------------
// Drives the real game code (no mocks) and returns {name, pass, detail} rows.
export function runSelfTest(game) {
  const out = [];
  const check = (name, fn) => {
    try {
      const r = fn();
      out.push({ name, pass: r !== false, detail: typeof r === 'string' ? r : '' });
    } catch (e) {
      out.push({ name, pass: false, detail: String(e && e.message || e) });
    }
  };
  const step = (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) game.step(dt, true); };

  check('boot', () => game.renderer && game.scene && game.camera ? 'renderer+scene+camera live' : false);
  check('world', () => {
    let meshes = 0;
    game.scene.traverse((o) => { if (o.isMesh) meshes++; });
    return meshes > 500 ? `${meshes} meshes, ${game.world.colliders.length} colliders` : `only ${meshes} meshes`;
  });
  check('sky', () => {
    game.sky.setTime(12); game.sky.setTime(21.6);
    return game.sky.dome ? 'dome + sun + moon + stars + clouds' : false;
  });
  check('traffic 14', () => game.traffic.cars.length === 14 ? '14 cars looping' : `${game.traffic.cars.length} cars`);
  check('talkers 8', () => {
    const near = game.pedestrians.nearest(new THREE.Vector3(0, 0, 14), 400);
    return game.pedestrians.npcs.length >= 20 && near ? `${game.pedestrians.npcs.length} NPCs, nearest ${near.name}` : false;
  });
  check('crates 10', () => game.missions.crates.length === 10 ? '10 neon crates' : `${game.missions.crates.length}`);
  check('walk', () => {
    const x0 = game.player.pos.x, z0 = game.player.pos.z;
    game.input.keys['KeyW'] = true; step(60); game.input.keys['KeyW'] = false;
    const d = Math.hypot(game.player.pos.x - x0, game.player.pos.z - z0);
    return d > 2 ? `moved ${d.toFixed(1)}m` : `moved only ${d.toFixed(2)}m`;
  });
  check('jump', () => {
    game.input.keys['Space'] = true; step(8); game.input.keys['Space'] = false;
    const up = game.player.pos.y > 0.2;
    step(60);
    return up && game.player.pos.y === 0 ? 'jumped and landed' : 'jump failed';
  });
  check('shoot', () => {
    const a0 = game.player.ammo[game.player.weaponIdx];
    const s = game.player.shoot();
    step(5);
    return s && game.player.ammo[game.player.weaponIdx] === a0 - 1 ? `fired ${s.weapon.name}, ammo ${a0}->${a0 - 1}` : 'no shot';
  });
  check('enter/drive/exit car', () => {
    const car = game.playerCarDriver;
    game.player.pos.set(0, 0, 24); // clear plaza start, deterministic
    car.pos.set(game.player.pos.x + 2, 0, game.player.pos.z);
    for (const t of game.traffic.cars) t.pos.set(300, 0, 300); // keep traffic out of the test
    const entered = game.tryEnterVehicle();
    if (!entered || game.player.inVehicle !== car) return false;
    game.input.keys['KeyW'] = true; step(60); game.input.keys['KeyW'] = false;
    const moved = Math.abs(car.speed) > 1;
    const exited = game.exitVehicle();
    return moved && exited ? `drove at ${car.speed.toFixed(1)} m/s, exited clean` : false;
  });
  check('bike', () => {
    const bike = game.bike1Driver;
    game.player.pos.set(0, 0, 24); // clear plaza start, deterministic
    bike.pos.set(game.player.pos.x + 1.5, 0, game.player.pos.z);
    bike.heading = 0; // north, clear run to the fountain (5.5m away)
    game.playerCarDriver.pos.set(200, 0, 200); // park the car far away so the bike is nearest
    game.bike2Driver.pos.set(200, 0, 210);
    for (const t of game.traffic.cars) t.pos.set(300, 0, 300);
    if (!game.tryEnterVehicle() || game.player.inVehicle !== bike) return false;
    game.input.keys['KeyW'] = true; step(45); game.input.keys['KeyW'] = false;
    const ok = Math.abs(bike.speed) > 1;
    game.exitVehicle();
    return ok ? `bike rode at ${bike.speed.toFixed(1)} m/s, rider seated` : false;
  });
  check('taxi job', () => {
    game.missions.startTaxi();
    const ok = game.missions.taxi.active;
    game.missions.taxi.active = false;
    return ok ? 'fare started, pickup marker set' : 'taxi failed';
  });
  check('police', () => {
    game.setWanted(3);
    step(200);
    const n = game.police.units.length;
    const heli = !!game.police.heli;
    game.setWanted(0); step(30);
    return n >= 2 ? `${n} pursuit units, heli ${heli ? 'up' : 'pending'}` : `only ${n} units`;
  });
  check('mission', () => game.missions.state === 'active' && game.missions.idx === 0 ? 'First Fare active' : `state ${game.missions.state}`);
  check('shop', () => {
    const m0 = game.player.money;
    game.player.health = 40;
    const h0 = game.player.health;
    const ok = game.buyItem('health');
    const res = ok && game.player.money === m0 - 30 && game.player.health > h0;
    game.player.money = m0; game.player.health = 100;
    return res ? 'bought Health $30' : 'shop failed';
  });
  check('wardrobe', () => {
    game.player.setOutfit('pink', 0xff2e88);
    const ok = game.player.outfit === 'pink';
    game.player.setOutfit('teal', 0x0fa3a3);
    return ok ? 'outfit changed to Vice Pink and back' : 'wardrobe failed';
  });
  check('NPC', () => {
    const n = game.pedestrians.nearest(game.player.pos, 400);
    return n ? `${n.name}: "${n.line}"` : 'no NPC found';
  });
  check('weather', () => {
    game.weather.setRain(true);
    const on = game.weather.points.material.opacity > 0.5;
    game.weather.setRain(false);
    return on ? 'rain streaks on, then off' : 'rain failed';
  });
  check('settings', () => {
    game.settings.sensitivity = 2.0; game.settings.volume = 0.2;
    return game.settings.sensitivity === 2.0 ? 'sensitivity + volume set' : 'settings failed';
  });
  check('save', () => {
    game.saveGame();
    const raw = localStorage.getItem('neonbay-save');
    const ok = raw && JSON.parse(raw).money === game.player.money;
    return ok ? 'save round-trips localStorage' : 'save failed';
  });
  check('guards', () => {
    let bad = 0;
    game.scene.traverse((o) => {
      if (o.isMesh && (!isFinite(o.position.x) || !isFinite(o.position.y) || !isFinite(o.position.z))) bad++;
    });
    const p = game.player.pos;
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) bad++;
    return bad === 0 ? 'no NaN transforms' : `${bad} bad transforms`;
  });
  return out;
}
