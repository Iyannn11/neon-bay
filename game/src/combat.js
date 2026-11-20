// Neon Bay combat: punch (F), pistol (mouse click, R reload), police return
// fire at high wanted. Shots are hitscan with a short tracer flash.

import * as THREE from '../vendor/three.module.min.js';
import { TUNING } from './config.js';

export function createCombat(scene, game) {
  let ammo = TUNING.pistolAmmo;
  let reloadTimer = 0;
  let punchCooldown = 0;
  let tracer = null;
  let tracerTimer = 0;

  const tracerMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a0,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  function showTracer(from, to) {
    if (tracer) scene.remove(tracer);
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    tracer = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 6), tracerMat);
    tracer.position.copy(from).addScaledVector(dir, 0.5);
    tracer.lookAt(to);
    tracer.rotateX(Math.PI / 2);
    scene.add(tracer);
    tracerTimer = 0.09;
  }

  function punch() {
    if (punchCooldown > 0) return;
    punchCooldown = 0.45;
    if (game.audio) game.audio.punch();
    const p = game.player;
    // Hit the nearest pedestrian in front, or a cop car at close range.
    let best = null;
    let bestD = 2.4;
    for (const w of game.pedestrians.walkers) {
      if (w.down) continue;
      const d = Math.hypot(w.x - p.pos.x, w.z - p.pos.z);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    if (best) {
      best.down = true;
      best.downTimer = 4;
      game.addWanted(0.4);
      game.hud.flash('Pedestrian down — the heat notices');
    }
  }

  function shoot(screenX, screenY) {
    if (reloadTimer > 0 || ammo <= 0) {
      if (ammo <= 0) reload();
      return;
    }
    ammo -= 1;
    if (game.audio) game.audio.gunshot();
    const p = game.player;
    // Aim from the camera through the click point.
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1,
    );
    ray.setFromCamera(ndc, game.camera);
    const origin = ray.ray.origin.clone();
    const dir = ray.ray.direction.clone();
    const end = origin.clone().addScaledVector(dir, 60);
    showTracer(origin, end);
    // Hit a police car within a cone of the ray.
    let hit = false;
    for (const car of game.police.cars) {
      const toCar = new THREE.Vector3(car.x - origin.x, 0.5 - origin.y, car.z - origin.z);
      const dist = toCar.length();
      if (dist < 55) {
        const along = toCar.dot(dir);
        const perp = Math.sqrt(Math.max(0, dist * dist - along * along));
        if (along > 0 && perp < 3.2) {
          hit = true;
          game.addWanted(0.7);
          game.hud.flash('Hit a police car!');
          break;
        }
      }
    }
    if (!hit) {
      // Wild shot still draws heat.
      game.addWanted(0.15);
    }
    if (ammo === 0) reload();
  }

  function reload() {
    if (reloadTimer > 0 || ammo === TUNING.pistolAmmo) return;
    reloadTimer = 1.4;
    game.hud.flash('Reloading…');
  }

  function update(dt) {
    punchCooldown = Math.max(0, punchCooldown - dt);
    if (reloadTimer > 0) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) {
        ammo = TUNING.pistolAmmo;
        game.hud.flash('Pistol reloaded');
      }
    }
    if (tracer) {
      tracerTimer -= dt;
      if (tracerTimer <= 0) {
        scene.remove(tracer);
        tracer = null;
      }
    }
    // Police return fire at 3+ stars: chips the player's health.
    if (game.wanted >= 3 && game.police.cars.length > 0) {
      game.fireClock = (game.fireClock || 0) - dt;
      if (game.fireClock <= 0) {
        game.fireClock = 1.6;
        const p = game.player;
        const nearest = game.police.cars.reduce((a, b) => {
          const da = Math.hypot(a.x - p.pos.x, a.z - p.pos.z);
          const db = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
          return da < db ? a : b;
        });
        const d = Math.hypot(nearest.x - p.pos.x, nearest.z - p.pos.z);
        if (d < 26) {
          p.health -= 6;
          showTracer(
            new THREE.Vector3(nearest.x, 1.2, nearest.z),
            new THREE.Vector3(p.pos.x, p.inCar ? 1.0 : 1.4, p.pos.z),
          );
          if (game.audio) game.audio.gunshot();
          game.hud.flash('Taking fire!');
          if (p.health <= 0) game.wasted();
        }
      }
    }
  }

  return {
    punch,
    shoot,
    reload,
    update,
    get ammo() {
      return ammo;
    },
    get reloading() {
      return reloadTimer > 0;
    },
  };
}
