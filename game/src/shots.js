// shots.js — deterministic staging for the four screenshots.
// The URL carries ?shot=start|chase|mission|night&seed=1337. Each shot places
// the player, the cars, the police and the camera exactly, then FREEZES the
// traffic and the police so the composition is the same every render. The
// main loop renders a few frames and then raises window.__neonReady so the
// screenshot tool knows the scene is settled.

export function getShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot') || '';
  const seed = parseInt(params.get('seed') || '1337', 10) || 1337;
  return { shot, seed };
}

// Put the player on foot at (x, z), facing `heading`.
function placePlayerOnFoot(game, x, z, heading) {
  game.player.x = x;
  game.player.z = z;
  game.player.heading = heading;
  game.player.inCar = false;
  game.player.car = null;
  game.player.mesh.position.set(x, 0, z);
  game.player.mesh.rotation.y = heading;
  game.player.mesh.visible = true;
}

// Put the player in a car at (x, z), facing `heading`.
function placePlayerInCar(game, x, z, heading) {
  const car = game.playerCar;
  car.place(x, z, heading);
  car.speed = 14;
  game.player.inCar = true;
  game.player.car = car;
  game.player.x = x;
  game.player.z = z;
  game.player.heading = heading;
  game.player.mesh.visible = false;
}

export function stageShot(game, name) {
  const city = game.city;
  // Every camera and every staged car sits ON a street (x or z a multiple of
  // 40, within the 12 m street width) and looks along it, so no building ever
  // blocks the frame. The player drives north/south on the x=0 avenue or
  // east/west on the z=40 avenue.
  if (name === 'start') {
    // Day. Kai on foot on the x=0 avenue, the NEON BAY sign and the towers
    // ahead of him, traffic rolling past in both lanes.
    city.setNight(false);
    game.night = false;
    placePlayerOnFoot(game, 0, -60, Math.PI);
    game.police.setWanted(0);
    game.missions.start(0);
    game.hud.setMission(game.missions.current(), game.missions.currentStep());
    game.traffic.cars.slice(0, 6).forEach((car, i) => {
      car.x = i % 2 === 0 ? -3 : 3;
      car.z = -80 - i * 9;
      car.axis = 'z';
      car.dir = i % 2 === 0 ? -1 : 1;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    });
    game.camera.position.set(0, 4.5, -38);
    game.camera.lookAt(0, 7, -110);
    game.camera.fov = 50;
    game.camera.updateProjectionMatrix();
    game.shotFrozen = true;
  } else if (name === 'chase') {
    // Night. A 5-star chase on the x=0 avenue: Kai driving north, a police
    // convoy in file behind him, the helicopter overhead, traffic ahead.
    city.setNight(true);
    game.night = true;
    placePlayerInCar(game, 0, 40, Math.PI);
    game.police.setWanted(5);
    game.missions.start(3);
    game.hud.setMission(game.missions.current(), game.missions.currentStep());
    const spots = [[-3, 54], [3, 60], [-3, 66], [3, 72], [0, 78]];
    while (game.police.cars.length < 5) game.police._spawnCar(0, 80);
    game.police.cars.forEach((car, i) => {
      const [x, z] = spots[i % spots.length];
      car.x = x;
      car.z = z;
      car.heading = Math.PI;
      car.speed = 34;
      car.mesh.position.set(x, 0, z);
      car.mesh.rotation.y = Math.PI;
    });
    // Helicopter overhead, searchlight on the chase.
    game.police.heli.visible = true;
    game.police.heli.position.set(14, 34, 18);
    game.police.heli.rotation.y = 0.6;
    game.traffic.cars.slice(0, 6).forEach((car, i) => {
      car.x = i % 2 === 0 ? -3 : 3;
      car.z = 4 - i * 9;
      car.axis = 'z';
      car.dir = -1;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = Math.PI / 2;
    });
    game.camera.position.set(0, 7, 90);
    game.camera.lookAt(0, 2, 22);
    game.camera.fov = 50;
    game.camera.updateProjectionMatrix();
    game.shotFrozen = true;
  } else if (name === 'mission') {
    // Dusk. The Coral Bank Job: Kai on foot at the bank (40,40), the vault
    // prompt up, police closing in on the avenues around him.
    city.setNight(false);
    game.night = false;
    placePlayerOnFoot(game, 34, 46, -0.6);
    game.police.setWanted(2);
    game.missions.start(4);
    game.missions.stepIndex = 1; // the vault-cracking step
    game.hud.setMission(game.missions.current(), game.missions.currentStep());
    game.hud.banner('THE CORAL BANK JOB', 'Crack the vault — hold E for 8 seconds');
    while (game.police.cars.length < 2) game.police._spawnCar(60, 40);
    game.police.cars[0].x = 58;
    game.police.cars[0].z = 40;
    game.police.cars[0].heading = -Math.PI / 2;
    game.police.cars[0].mesh.position.set(58, 0, 40);
    game.police.cars[0].mesh.rotation.y = -Math.PI / 2;
    game.police.cars[1].x = 40;
    game.police.cars[1].z = 64;
    game.police.cars[1].heading = Math.PI;
    game.police.cars[1].mesh.position.set(40, 0, 64);
    game.police.cars[1].mesh.rotation.y = Math.PI;
    game.camera.position.set(74, 5, 40);
    game.camera.lookAt(32, 3, 42);
    game.camera.fov = 50;
    game.camera.updateProjectionMatrix();
    game.shotFrozen = true;
  } else if (name === 'night') {
    // Night. Kai DRIVING south down the x=0 avenue, streetlights glowing, a
    // patrol car in the mirror, the towers lit behind.
    city.setNight(true);
    game.night = true;
    placePlayerInCar(game, 0, -100, 0);
    game.police.setWanted(1);
    game.missions.start(0);
    game.hud.setMission(game.missions.current(), game.missions.currentStep());
    while (game.police.cars.length < 1) game.police._spawnCar(0, -70);
    game.police.cars[0].x = 3;
    game.police.cars[0].z = -72;
    game.police.cars[0].heading = 0;
    game.police.cars[0].mesh.position.set(3, 0, -72);
    game.police.cars[0].mesh.rotation.y = 0;
    game.traffic.cars.slice(0, 6).forEach((car, i) => {
      car.x = i % 2 === 0 ? -3 : 3;
      car.z = -62 + i * 9;
      car.axis = 'z';
      car.dir = 1;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -Math.PI / 2;
    });
    game.camera.position.set(0, 5, -128);
    game.camera.lookAt(0, 2, -68);
    game.camera.fov = 50;
    game.camera.updateProjectionMatrix();
    game.shotFrozen = true;
  }
  // Hide the title screen for every shot and show the HUD.
  game.setScreen('playing');
  window.__neonReady = false;
  window.__neonDebug = { shot: name, frozen: true };
}
