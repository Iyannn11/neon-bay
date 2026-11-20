// Neon Bay police: wanted 0–5, pursuit cars, roadblocks, a helicopter with a
// searchlight at 4+ stars, and "busted" when a cop reaches the player on foot.

import * as THREE from '../vendor/three.module.min.js';
import { TUNING } from './config.js';
import { makeCarMesh, resolveCircle } from './vehicles.js';
import { getGlowTexture } from './city.js';

export function createPolice(scene, rng, city) {
  const colliders = city.colliders;
  const cars = [];
  const roadblocks = [];
  let heli = null;
  let heliLight = null;
  let heliGlow = null;
  let sirenTimer = 0;

  function spawnCar(x, z) {
    const mesh = makeCarMesh(0x14161c, 'police');
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    const car = { mesh, x, z, heading: 0, speed: 0 };
    cars.push(car);
    return car;
  }

  function spawnHeli() {
    if (heli) return;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c2f45, roughness: 0.4, metalness: 0.6 });
    // Cylinder fuselage + rounded nose (smooth, not a box).
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 4.6, 14), bodyMat);
    fuselage.rotation.z = Math.PI / 2;
    fuselage.castShadow = true;
    group.add(fuselage);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1.15, 14, 10), bodyMat);
    nose.position.set(2.3, 0, 0);
    group.add(nose);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 4.5, 10), bodyMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.set(-4.2, 0.3, 0);
    group.add(tail);
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x10151f, roughness: 0.1, metalness: 0.9 }),
    );
    glass.position.set(1.6, 0.45, 0);
    group.add(glass);
    // Rotor: two thin blades.
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
    const rotor = new THREE.Group();
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), rotorMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 9), rotorMat);
    rotor.add(blade1);
    rotor.add(blade2);
    rotor.position.y = 1.4;
    group.add(rotor);
    // Searchlight.
    heliLight = new THREE.SpotLight(0xfff2b0, 900, 120, 0.32, 0.5, 1.2);
    heliLight.position.set(0, -0.8, 0);
    group.add(heliLight);
    heliLight.target.position.set(0, -40, 0);
    group.add(heliLight.target);
    heliGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color: 0xfff2b0,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    heliGlow.scale.set(6, 6, 1);
    heliGlow.position.set(0, -1, 0);
    group.add(heliGlow);
    group.position.set(0, TUNING.heliHeight, 0);
    scene.add(group);
    heli = { group, rotor, x: 0, z: 0 };
  }

  function removeHeli() {
    if (!heli) return;
    scene.remove(heli.group);
    heli = null;
    heliLight = null;
    heliGlow = null;
  }

  function setRoadblocks(game, count) {
    // Clear old ones, then park police cars across the street ahead of the player.
    for (const rb of roadblocks) scene.remove(rb.mesh.group);
    roadblocks.length = 0;
    if (count <= 0) return;
    const p = game.player;
    for (let i = 0; i < count; i++) {
      const ahead = 34 + i * 26;
      const x = p.pos.x + Math.cos(p.heading) * ahead + (i % 2 === 0 ? 6 : -6);
      const z = p.pos.z + Math.sin(p.heading) * ahead + (i % 2 === 0 ? -6 : 6);
      const mesh = makeCarMesh(0x14161c, 'police');
      mesh.group.position.set(x, 0, z);
      mesh.group.rotation.y = -p.heading + Math.PI / 2;
      scene.add(mesh.group);
      roadblocks.push({ mesh, x, z });
    }
  }

  function wantedCarCount(wanted) {
    if (wanted <= 0) return 0;
    if (wanted <= 1) return 1;
    if (wanted <= 2) return 2;
    if (wanted <= 3) return 3;
    if (wanted <= 4) return 4;
    return 5;
  }

  function update(dt, game) {
    const wanted = game.wanted;
    const p = game.player;

    // Keep the right number of pursuit cars.
    const want = wantedCarCount(wanted);
    while (cars.length < want) {
      const a = rng.next() * Math.PI * 2;
      spawnCar(p.pos.x + Math.cos(a) * 55, p.pos.z + Math.sin(a) * 55);
    }
    while (cars.length > want) {
      const car = cars.pop();
      scene.remove(car.mesh.group);
    }

    // Pursuit: steer toward the player, ram on foot, chase the car.
    for (const car of cars) {
      const dx = p.pos.x - car.x;
      const dz = p.pos.z - car.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dz, dx);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const top = Math.min(TUNING.policeTopSpeed, 18 + wanted * 4);
      car.speed += (top - car.speed) * Math.min(1, dt * 0.8);
      const nx = car.x + Math.cos(car.heading) * car.speed * dt;
      const nz = car.z + Math.sin(car.heading) * car.speed * dt;
      const fixed = resolveCircle(nx, nz, 2.1, colliders);
      car.x = fixed.x;
      car.z = fixed.z;
      car.mesh.group.position.set(car.x, 0, car.z);
      car.mesh.group.rotation.y = -car.heading;
      for (const w of car.mesh.wheels) w.rotation.z += car.speed * dt * 2.2;
      // Flash the light bar.
      if (car.mesh.lightBar) {
        car.mesh.lightBar.phase += dt * 9;
        const on = Math.sin(car.mesh.lightBar.phase) > 0;
        car.mesh.lightBar.redMat.emissiveIntensity = on ? 2.4 : 0.25;
        car.mesh.lightBar.blueMat.emissiveIntensity = on ? 0.25 : 2.4;
      }
      // Busted: a cop touches the player on foot at 2+ stars.
      if (!p.inCar && dist < 2.6 && wanted >= 2) {
        game.busted();
      }
      // Ram the player's car.
      if (p.inCar && dist < 4.4) {
        p.carSpeed *= 0.94;
        car.speed *= 0.9;
      }
    }

    // Helicopter at 4+ stars.
    if (wanted >= 4) {
      spawnHeli();
      if (heli) {
        heli.x += (p.pos.x - heli.x) * Math.min(1, dt * 0.7);
        heli.z += (p.pos.z - heli.z) * Math.min(1, dt * 0.7);
        heli.group.position.set(heli.x, TUNING.heliHeight + Math.sin(game.time * 0.8) * 2, heli.z);
        heli.rotor.rotation.y += dt * 22;
        heli.group.rotation.y = -Math.atan2(p.pos.z - heli.z, p.pos.x - heli.x);
        heliLight.target.position.set(p.pos.x - heli.x, -TUNING.heliHeight, p.pos.z - heli.z);
      }
    } else {
      removeHeli();
    }

    // Roadblocks at 3+ stars, refreshed every few seconds.
    sirenTimer -= dt;
    if (wanted >= 3 && sirenTimer <= 0) {
      setRoadblocks(game, wanted >= 5 ? 2 : 1);
      sirenTimer = 6;
    }
    if (wanted < 3 && roadblocks.length > 0) setRoadblocks(game, 0);

    // Siren blips while wanted.
    if (wanted > 0 && game.audio) {
      game.sirenClock = (game.sirenClock || 0) - dt;
      if (game.sirenClock <= 0) {
        game.audio.siren(true);
        game.sirenClock = 1.9;
      }
    }
  }

  // Spawn N pursuit cars immediately (used by shot staging, before any update).
  function ensureCars(n) {
    while (cars.length < n) {
      const a = rng.next() * Math.PI * 2;
      spawnCar(55 * Math.cos(a), 55 * Math.sin(a));
    }
  }

  return { update, ensureCars, cars, roadblocks, get heli() { return heli; } };
}
