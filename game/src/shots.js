// Neon Bay — screenshot staging. Each named shot arranges the world, the
// player and the camera like a film still, then freezes the pose while the
// city stays alive behind it (traffic, ocean, clouds keep moving).
import * as THREE from 'three';

function placePlayer(game, x, z, yaw) {
  game.player.pos.set(x, 0, z);
  game.player.yaw = yaw;
  game.player.pitch = 0;
  game.player.group.position.copy(game.player.pos);
  game.player.group.rotation.y = yaw;
}

function freezePose(game, legSwing, armSwing, aiming) {
  game.player.aiming = aiming;
  game.player.legL.rotation.x = legSwing;
  game.player.legR.rotation.x = -legSwing;
  if (aiming) {
    game.player.armR.rotation.x = -Math.PI / 2 + 0.15;
    game.player.armL.rotation.x = -Math.PI / 2 + 0.3;
    game.player.torso.rotation.x = 0.08;
  } else {
    game.player.armL.rotation.x = -armSwing;
    game.player.armR.rotation.x = armSwing;
  }
}

export function stageShot(game, name) {
  game.showcase = true;
  document.getElementById('hint').style.display = 'none';
  const P = game.player;
  // Pin the clock to the shot's time of day (the loop's updateClock is
  // frozen during showcase, but the HUD clock must match the sky).
  const clockFor = { night: 21.6 * 60, golden: 17.5 * 60, morning: 6.5 * 60, day: 10 * 60 };

  if (name === 'cover') {
    // Night neon plaza: Kai mid-stride in a 3/4 view, skyline behind him,
    // chrome SMG catching the light, 2 wanted stars on the HUD.
    game.setTimeOfDay('night');
    game.clockMinutes = clockFor.night;
    game.weather.set('clear');
    placePlayer(game, 2, 20, Math.PI * 0.78);
    P.weaponIndex = 1;
    freezePose(game, 0.55, 0.45, false);
    game.police.addHeat(45);
    // Park the cruisers at the plaza edges so none of them drives in
    // front of Kai (cops freeze during showcase, see main.js).
    const copSpots = [[30, 38], [-16, 36], [24, 8]];
    game.police.cops.forEach((c, i) => {
      const s = copSpots[i % copSpots.length];
      c.mesh.position.set(s[0], 0, s[1]);
      c.mesh.rotation.y = -0.8;
    });
    game.shotCam = {
      pos: new THREE.Vector3(9, 2.8, 29),
      look: new THREE.Vector3(1, 1.3, 19),
    };
    game.shotDrive = 0;
  } else if (name === 'drive') {
    // Golden hour on the highway ring: red sport, low chase camera.
    game.setTimeOfDay('golden');
    game.clockMinutes = clockFor.golden;
    game.weather.set('clear');
    const car = game.spawnParked('sport', 190, -150, Math.PI);
    placePlayer(game, 190, -150, Math.PI);
    game.enterVehicle(car);
    game.vehicle.speed = 14;
    game.shotCam = {
      pos: new THREE.Vector3(190, 3.2, -138),
      look: new THREE.Vector3(190, 1.4, -152),
    };
    game.shotDrive = 14;
  } else if (name === 'mission') {
    // Mission 6 at the marina at MORNING: pink-orange horizon light, wide
    // shot — Kai aiming, 4 guards, a cruiser in the left of frame, the
    // pink beacon overhead.
    game.setTimeOfDay('morning');
    game.clockMinutes = clockFor.morning;
    game.weather.set('clear');
    game.missions.setMission(5);
    game.spawnGuards();
    placePlayer(game, 190, 120, -Math.PI * 0.32);
    P.weaponIndex = 1;
    freezePose(game, 0.15, 0.2, true);
    const cop = game.police.cops[0] || null;
    if (!cop) {
      game.police.addHeat(45);
    }
    if (game.police.cops[0]) {
      game.police.cops[0].mesh.position.set(168, 0, 118);
      game.police.cops[0].mesh.rotation.y = 0.6;
    }
    game.shotCam = {
      pos: new THREE.Vector3(176, 9, 100),
      look: new THREE.Vector3(200, 2, 142),
    };
    game.shotDrive = 0;
  } else if (name === 'beach') {
    // Golden hour on the sand: Kai riding the cruiser, palms and ocean.
    game.setTimeOfDay('golden');
    game.clockMinutes = clockFor.golden;
    game.weather.set('clear');
    const bike = game.spawnBike(false, 244, 44);
    placePlayer(game, 244, 44, Math.PI * 0.5);
    game.enterVehicle(bike);
    game.vehicle.speed = 8;
    game.shotCam = {
      pos: new THREE.Vector3(232, 2.6, 58),
      look: new THREE.Vector3(246, 1.2, 42),
    };
    game.shotDrive = 8;
  } else {
    game.showcase = false;
  }

  if (game.showcase && game.shotCam) {
    game.camera.position.copy(game.shotCam.pos);
    game.camera.lookAt(game.shotCam.look);
  }
}
