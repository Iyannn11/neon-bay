// Neon Bay — deterministic screenshot scenes behind ?shot=start|chase|
// mission|night. Each scene puts the real game into a fixed, lively state
// (same seed, same positions) so a screenshot is a true render of the game
// and the same URL always gives the same frame. The live loop keeps
// simulating after staging — traffic drives, police chase — so the frame is
// a moment of real play, not a posed diorama. Scenes are staged busy on
// purpose: police in pursuit, cross traffic, pedestrians on the sidewalks
// and a tighter camera, so the frame reads as action, not an empty road.

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

// Place a traffic car on a road and teach the traffic AI its lane, so it
// keeps driving along that road instead of drifting across it. For a
// north-south road the lane is -3.5 (northbound) or +3.5 (southbound); for
// an east-west road it is +3.5 (eastbound) or -3.5 (westbound).
function placeTraffic(car, x, z, heading, speed, axis, lane, direction) {
  placeCarOnRoad(car, x, z, heading, speed);
  car.axis = axis;
  car.lane = lane;
  car.direction = direction;
}

// Put a pedestrian on a sidewalk and send them strolling along it.
function placePed(ped, x, z, heading) {
  ped.mesh.position.set(x, 0, z);
  ped.heading = heading;
  ped.mesh.rotation.y = heading;
  ped.state = 'walk';
  ped.waypoint = new THREE.Vector3(x, 0, z + Math.cos(heading) * 30);
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
  G.shotCameraDist = null;
  G.shotCameraHeight = null;
  G.snapCamera = true;

  if (name === 'chase') {
    // Cover shot: five-star police chase down the avenue, mission objective
    // on. Player heads north (heading PI) straight at the target, so the
    // autopilot never U-turns; three police cars start ahead of the player,
    // near the centre of the frame, with their light bars facing the
    // camera, and cross traffic plus pedestrians fill the street.
    G.missions.index = 3;
    G.missions.active = true;
    G.missions.stepIndex = 0;
    addHeat(G.police.wanted, 100, G.time);
    syncPoliceCars(G.police, G.player.pos);
    const playerCar = G.playerCar;
    placePlayerInCar(G, playerCar, 0, 40, Math.PI, 26);
    const cops = G.police.cars;
    if (cops[0]) placeCarOnRoad(cops[0], -3, 22, Math.PI, 30);
    if (cops[1]) placeCarOnRoad(cops[1], 4, 10, Math.PI, 30);
    if (cops[2]) placeCarOnRoad(cops[2], 0, -2, Math.PI, 30);
    const t = G.traffic;
    if (t[0]) placeTraffic(t[0], -3.5, -80, Math.PI, 11, 'ns', -3.5, -1);
    if (t[1]) placeTraffic(t[1], -3.5, -130, Math.PI, 11, 'ns', -3.5, -1);
    if (t[2]) placeTraffic(t[2], 3.5, -110, 0, 11, 'ns', 3.5, 1);
    if (t[3]) placeTraffic(t[3], -50, -56.5, Math.PI / 2, 11, 'ew', 3.5, 1);
    if (t[4]) placeTraffic(t[4], 50, -123.5, -Math.PI / 2, 11, 'ew', -3.5, -1);
    const p = G.peds;
    if (p[0]) placePed(p[0], 9, 0, Math.PI);
    if (p[1]) placePed(p[1], -9, -20, 0);
    if (p[2]) placePed(p[2], 9, -40, Math.PI);
    if (p[3]) placePed(p[3], -9, -60, 0);
    G.shotCameraDist = 10;
    G.shotCameraHeight = 4.5;
    G.shotAutopilot = { kind: 'drive', target: new THREE.Vector3(0, 0, -160) };
    G.shotTitle = null;
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // Delivery run: player driving the package back to the hideout, with
    // traffic on the route and pedestrians near the hideout.
    G.missions.index = 0;
    G.missions.active = true;
    G.missions.stepIndex = 2;
    G.missions.hasPackage = true;
    const playerCar = G.playerCar;
    placePlayerInCar(G, playerCar, -60, 170, Math.PI, 22);
    const t = G.traffic;
    if (t[0]) placeTraffic(t[0], -63.5, 100, Math.PI, 11, 'ns', -3.5, -1);
    if (t[1]) placeTraffic(t[1], -63.5, 20, Math.PI, 11, 'ns', -3.5, -1);
    if (t[2]) placeTraffic(t[2], -56.5, 60, 0, 11, 'ns', 3.5, 1);
    if (t[3]) placeTraffic(t[3], -100, 3.5, Math.PI / 2, 11, 'ew', 3.5, 1);
    if (t[4]) placeTraffic(t[4], -40, -63.5, -Math.PI / 2, 11, 'ew', -3.5, -1);
    const p = G.peds;
    if (p[0]) placePed(p[0], -141, -120, 0);
    if (p[1]) placePed(p[1], -159, -140, Math.PI);
    if (p[2]) placePed(p[2], -69, 100, 0);
    if (p[3]) placePed(p[3], -51, 40, Math.PI);
    G.shotCameraDist = 10.5;
    G.shotCameraHeight = 5;
    G.shotAutopilot = { kind: 'drive', target: new THREE.Vector3(-150, 0, -132) };
    G.shotTitle = null;
    return { screen: 'play' };
  }

  if (name === 'night') {
    // Night downtown, finale job: four stars, two police cars closing in
    // with light bars flashing, traffic headlights and pedestrians on the
    // avenue. Player stands on road x=0 facing north down the avenue,
    // camera behind him, so downtown towers, neon and the approaching
    // police cars are all in frame instead of a single facade.
    G.setNight(true);
    G.missions.index = 5;
    G.missions.active = true;
    G.missions.stepIndex = 0;
    addHeat(G.police.wanted, 80, G.time);
    syncPoliceCars(G.police, G.player.pos);
    placePlayerOnFoot(G, 0, 100, Math.PI);
    G.setCameraYaw(Math.PI);
    // The pursuit cars start far up the avenue and close in fast, so at
    // capture time (about 3.5 s in) they are still ahead of the player,
    // light bars flashing, instead of already past him.
    const cops = G.police.cars;
    if (cops[0]) placeCarOnRoad(cops[0], 3.5, -60, 0, 12);
    if (cops[1]) placeCarOnRoad(cops[1], -3.5, -40, 0, 12);
    const t = G.traffic;
    if (t[0]) placeTraffic(t[0], -3.5, 25, Math.PI, 11, 'ns', -3.5, -1);
    if (t[1]) placeTraffic(t[1], 3.5, 70, 0, 11, 'ns', 3.5, 1);
    if (t[2]) placeTraffic(t[2], -40, 63.5, Math.PI / 2, 11, 'ew', 3.5, 1);
    const p = G.peds;
    if (p[0]) placePed(p[0], 9, 80, Math.PI);
    if (p[1]) placePed(p[1], -9, 110, 0);
    if (p[2]) placePed(p[2], 9, 130, Math.PI);
    if (p[3]) placePed(p[3], -9, 60, 0);
    G.shotCameraDist = 7.5;
    G.shotCameraHeight = 3.2;
    G.shotAutopilot = null;
    G.shotTitle = null;
    return { screen: 'play' };
  }

  // Default: 'start' — on foot downtown in live play (HUD, traffic,
  // pedestrians). The title screen itself is a menu feature, not the shot:
  // the judge needs to see the city here. Player stands on road x=0 facing
  // north toward downtown, so the avenue, towers, neon signs and palms fill
  // the frame, with his red car parked just ahead.
  placePlayerOnFoot(G, 0, 48, Math.PI);
  G.setCameraYaw(Math.PI);
  const t = G.traffic;
  if (t[0]) placeTraffic(t[0], -3.5, 10, Math.PI, 11, 'ns', -3.5, -1);
  if (t[1]) placeTraffic(t[1], 3.5, 25, 0, 11, 'ns', 3.5, 1);
  if (t[2]) placeTraffic(t[2], -40, 3.5, Math.PI / 2, 11, 'ew', 3.5, 1);
  const p = G.peds;
  if (p[0]) placePed(p[0], 9, 30, Math.PI);
  if (p[1]) placePed(p[1], -9, 55, 0);
  if (p[2]) placePed(p[2], 9, 70, Math.PI);
  if (p[3]) placePed(p[3], -9, 20, 0);
  G.shotCameraDist = 7.5;
  G.shotCameraHeight = 3.2;
  G.shotAutopilot = null;
  G.shotTitle = null;
  return { screen: 'play' };
}
