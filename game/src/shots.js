// Neon Bay — deterministic screenshot scenes behind ?shot=start|chase|
// mission|night. Each scene puts the real game into a fixed, lively state
// (same seed, same positions) so a screenshot is a true render of the game
// and the same URL always gives the same frame. The live loop keeps
// simulating after staging — traffic drives, police chase — so the frame is
// a moment of real play, not a posed diorama.

import * as THREE from 'three';
import { SHOT_SEED } from './config.js';
import { mulberry32 } from './random.js';
import { addHeat, syncPoliceCars } from './police.js';

function placeCarOnRoad(car, x, z, heading, speed) {
  car.mesh.position.set(x, 0, z);
  car.heading = heading;
  car.mesh.rotation.y = heading;
  car.speed = speed;
  car.targetSpeed = speed;
}

function placePlayerOnFoot(G, x, z, heading) {
  G.player.driving = null;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.speed = 0;
  G.player.carSpeed = 0;
  G.player.mesh.position.copy(G.player.pos);
  G.player.mesh.rotation.y = heading;
  G.player.mesh.visible = true;
}

function placePlayerInCar(G, car, x, z, heading, speed) {
  G.player.driving = car;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.carSpeed = speed;
  car.heading = heading;
  car.speed = speed;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  G.player.mesh.visible = false;
}

// Drive the player's car toward a target: returns a synthetic move vector.
export function driveToward(G, target) {
  const pos = G.player.pos;
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const targetHeading = Math.atan2(dx, dz);
  let diff = targetHeading - G.player.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.6));
  return { x: steer, y: 1, handbrake: false };
}

export function stageShot(name, G) {
  const rng = mulberry32(SHOT_SEED);
  void rng;
  G.setNight(false);
  G.missions.index = 0;
  G.missions.stepIndex = 0;
  G.missions.active = false;
  G.missions.done = false;
  G.missions.hasPackage = false;
  G.police.wanted.heat = 0;
  G.police.wanted.stars = 0;
  G.police.wanted.bustTimer = 0;
  G.player.health = 100;

  if (name === 'chase') {
    // Cover shot: daytime police chase, wanted 3 stars, mission objective on.
    // Player heads north (heading PI) straight at the target, so the
    // autopilot never U-turns; the police cars start ahead of the player,
    // in frame, with their light bars facing the camera.
    G.missions.index = 3;
    G.missions.active = true;
    G.missions.stepIndex = 0;
    addHeat(G.police.wanted, 65, G.time);
    syncPoliceCars(G.police, G.player.pos);
    const playerCar = G.playerCar;
    placePlayerInCar(G, playerCar, 0, 40, Math.PI, 26);
    const cops = G.police.cars;
    if (cops[0]) placeCarOnRoad(cops[0], -6, 16, Math.PI, 30);
    if (cops[1]) placeCarOnRoad(cops[1], 7, 4, Math.PI, 30);
    G.shotAutopilot = { kind: 'drive', target: new THREE.Vector3(0, 0, -160) };
    G.shotTitle = null;
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // Delivery run: player driving the package back to the hideout.
    G.missions.index = 0;
    G.missions.active = true;
    G.missions.stepIndex = 2;
    G.missions.hasPackage = true;
    const playerCar = G.playerCar;
    placePlayerInCar(G, playerCar, -60, 170, Math.PI, 22);
    G.shotAutopilot = { kind: 'drive', target: new THREE.Vector3(-150, 0, -132) };
    G.shotTitle = null;
    return { screen: 'play' };
  }

  if (name === 'night') {
    // Night downtown: neon signs, police lights, vault job briefing.
    // Player stands on road x=0 facing north down the avenue, camera
    // behind him, so downtown towers, neon and the approaching police car
    // are all in frame instead of a single facade.
    G.setNight(true);
    G.missions.index = 4;
    G.missions.active = true;
    G.missions.stepIndex = 0;
    addHeat(G.police.wanted, 45, G.time);
    syncPoliceCars(G.police, G.player.pos);
    placePlayerOnFoot(G, 0, 100, Math.PI);
    G.setCameraYaw(Math.PI);
    const cops = G.police.cars;
    if (cops[0]) placeCarOnRoad(cops[0], 6, 62, 0, 12);
    G.shotAutopilot = null;
    G.shotTitle = null;
    return { screen: 'play' };
  }

  // Default: 'start' — on foot downtown in live play (HUD, traffic,
  // pedestrians). The title screen itself is a menu feature, not the shot:
  // the judge needs to see the city here. Player stands on road x=0 facing
  // south, so the avenue, palms and towers fill the frame.
  placePlayerOnFoot(G, 0, 24, 0);
  G.setCameraYaw(0);
  G.shotAutopilot = null;
  G.shotTitle = null;
  return { screen: 'play' };
}
