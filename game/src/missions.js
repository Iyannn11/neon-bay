// Neon Bay missions: the six-job chain. Each mission is a list of steps; the
// player finishes them in order and is paid the reward. Step kinds: goto,
// pickup, steal, deliverCar, follow, escape, hold.

import * as THREE from '../vendor/three.module.min.js';
import { MISSIONS, PLACES } from './config.js';
import { getGlowTexture } from './city.js';

export function createMissions(scene, game) {
  let index = 0;
  let stepIndex = 0;
  let holdProgress = 0;
  let followTimer = 0;
  let escapeTimer = 0;
  let courier = null;
  let beacon = null;
  let beaconGlow = null;
  let arrow = null;

  // The objective beacon: a glowing cylinder + a pulsing ring on the ground.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffd23f,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
  });
  function showBeacon(x, z, radius) {
    hideBeacon();
    beacon = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.38, radius * 0.38, 26, 20, 1, true), beaconMat);
    beacon.position.set(x, 13, z);
    scene.add(beacon);
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 0.8, radius, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.12, z);
    scene.add(ring);
    beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0xffd23f,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    beaconGlow.scale.set(8, 8, 1);
    beaconGlow.position.set(x, 2, z);
    scene.add(beaconGlow);
    beacon.userData.ring = ring;
  }
  function hideBeacon() {
    if (beacon) {
      scene.remove(beacon);
      scene.remove(beacon.userData.ring);
      beacon = null;
    }
    if (beaconGlow) {
      scene.remove(beaconGlow);
      beaconGlow = null;
    }
  }

  function current() {
    return MISSIONS[index] || null;
  }
  function step() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }
  function placeOf(stepDef) {
    return PLACES[stepDef.place];
  }
  function distToPlace(place) {
    const p = game.player.pos;
    return Math.hypot(place.x - p.x, place.z - p.z);
  }

  function startMission(i) {
    index = i;
    stepIndex = 0;
    holdProgress = 0;
    followTimer = 0;
    escapeTimer = 0;
    const m = current();
    if (!m) return;
    game.hud.banner(`Job ${i + 1}/6 — ${m.name}`, m.intro);
    game.hud.setMission(m.name, m.steps[0].text);
    if (game.audio) game.audio.pickup();
    const s = step();
    if (s && (s.kind === 'goto' || s.kind === 'pickup' || s.kind === 'steal' || s.kind === 'deliverCar' || s.kind === 'hold')) {
      const pl = placeOf(s);
      showBeacon(pl.x, pl.z, s.radius || 8);
    }
    if (s && s.kind === 'follow') {
      startCourier();
    }
    if (s && s.kind === 'escape') {
      game.addWanted(3);
      game.hud.flash('The police are on you — lose them!');
    }
  }

  function startCourier() {
    // The courier is a traffic car we single out and make drive a loop.
    const traffic = game.vehicles.traffic;
    courier = traffic[0];
    courier.courier = true;
    courier.targetSpeed = 8;
    game.hud.flash('The courier is moving — tail him');
  }

  function finishStep() {
    stepIndex++;
    holdProgress = 0;
    const m = current();
    if (!m) return;
    if (stepIndex >= m.steps.length) {
      finishMission();
      return;
    }
    const s = step();
    game.hud.setMission(m.name, s.text);
    if (s.kind === 'goto' || s.kind === 'pickup' || s.kind === 'steal' || s.kind === 'deliverCar' || s.kind === 'hold') {
      const pl = placeOf(s);
      showBeacon(pl.x, pl.z, s.radius || 8);
    } else {
      hideBeacon();
    }
    if (s.kind === 'follow') startCourier();
    if (s.kind === 'escape') {
      game.addWanted(3);
      game.hud.flash('The police are on you — lose them!');
    }
    if (game.audio) game.audio.pickup();
  }

  function finishMission() {
    const m = current();
    game.cash += m.reward;
    game.missionsDone++;
    game.hud.banner(`Job complete — ${m.name}`, `+$${m.reward.toLocaleString()}`);
    if (game.audio) game.audio.cash();
    game.save();
    hideBeacon();
    courier = null;
    if (index + 1 < MISSIONS.length) {
      startMission(index + 1);
    } else {
      game.hud.banner('KING OF THE BAY', 'You own Neon Bay. Every job done.');
      game.hud.setMission('Complete', 'Neon Bay is yours — free roam');
    }
  }

  function update(dt) {
    const m = current();
    if (!m) return;
    const s = step();
    if (!s) return;
    const p = game.player;
    if (s.kind === 'goto') {
      const pl = placeOf(s);
      if (distToPlace(pl) < (s.radius || 8)) finishStep();
    } else if (s.kind === 'pickup') {
      const pl = placeOf(s);
      if (distToPlace(pl) < (s.radius || 5) && game.input.pressedE) {
        game.hud.flash('Package picked up');
        if (game.audio) game.audio.pickup();
        finishStep();
      }
    } else if (s.kind === 'steal') {
      // Near the Comet GT on foot + E steals it (enters the car).
      const gt = game.vehicles.cometGt;
      const d = Math.hypot(gt.x - p.pos.x, gt.z - p.pos.z);
      if (d < (s.radius || 7) && !p.inCar && game.input.pressedE) {
        game.vehicles.enterCar(game, gt);
        game.addWanted(1);
        game.hud.flash('Comet GT stolen — the heat notices');
        finishStep();
      }
    } else if (s.kind === 'deliverCar') {
      const pl = placeOf(s);
      if (p.inCar && distToPlace(pl) < (s.radius || 9)) {
        game.vehicles.exitCar(game);
        finishStep();
      }
    } else if (s.kind === 'follow') {
      if (!courier) return;
      const d = Math.hypot(courier.x - p.pos.x, courier.z - p.pos.z);
      // Too close = spotted; too far = lost. The sweet spot is 8–26.
      if (d < 7) {
        game.hud.setMission(m.name, 'Too close — back off!');
        followTimer = 0;
      } else if (d > 30) {
        game.hud.setMission(m.name, 'You lost him — catch up!');
        followTimer = 0;
      } else {
        followTimer += dt;
        game.hud.setMission(m.name, `Tail the courier — ${Math.ceil(12 - followTimer)}s`);
        if (followTimer >= 12) {
          courier.courier = false;
          courier = null;
          finishStep();
        }
      }
    } else if (s.kind === 'escape') {
      const pl = placeOf(s);
      if (game.wanted <= 0) {
        escapeTimer += dt;
        game.hud.setMission(m.name, `Heat lost — reach ${pl.name}`);
        if (distToPlace(pl) < (s.radius || 10)) finishStep();
      } else {
        escapeTimer = 0;
        game.hud.setMission(m.name, `Lose the police (${game.wanted}★) then reach ${pl.name}`);
      }
    } else if (s.kind === 'hold') {
      const pl = placeOf(s);
      if (distToPlace(pl) < (s.radius || 7) && (game.input.keys['e'] === true)) {
        holdProgress += dt;
        game.hud.setMission(m.name, `${s.text} — ${Math.ceil(s.hold - holdProgress)}s`);
        if (holdProgress >= s.hold) {
          holdProgress = 0;
          finishStep();
        }
      } else {
        holdProgress = 0;
      }
    }
    // Pulse the beacon.
    if (beacon) {
      const t = game.time * 2.4;
      beacon.material.opacity = 0.35 + Math.sin(t) * 0.2;
      const ring = beacon.userData.ring;
      if (ring) {
        const sc = 1 + Math.sin(t) * 0.12;
        ring.scale.set(sc, sc, 1);
      }
    }
  }

  // The HUD arrow points at the current objective.
  function objectivePos() {
    const s = step();
    if (!s) return null;
    if (s.kind === 'follow' && courier) return { x: courier.x, z: courier.z };
    if (s.place) {
      const pl = placeOf(s);
      return { x: pl.x, z: pl.z };
    }
    return null;
  }

  return {
    update,
    startMission,
    objectivePos,
    get index() {
      return index;
    },
    get mission() {
      return current();
    },
    get stepText() {
      const s = step();
      return s ? s.text : '';
    },
  };
}
