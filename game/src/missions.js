// Neon Bay — story missions. Five chained jobs for Kai Reyes, each a short
// list of generic steps: go to a place, pick something up, steal and deliver
// a car, tail a van without being seen, lose the cops, or hold a spot to
// crack the vault. The HUD reads the current objective text and target
// position from here; a glowing beacon marks the target in the world.

import * as THREE from 'three';
import { MISSIONS } from './config.js';

function stepText(step) {
  if (step.type === 'goto') return step.text;
  if (step.type === 'pickup') return step.text;
  if (step.type === 'deliverCar') return step.text;
  if (step.type === 'follow') return step.text;
  if (step.type === 'escape') return step.text;
  if (step.type === 'hold') return step.text;
  return '';
}

// Build the five missions from the city landmarks. `world` carries the
// landmarks, the courier van state and the special yellow car.
export function createMissions(world) {
  const L = world.landmarks;
  const missionDefs = [
    {
      def: MISSIONS[0],
      steps: [
        { type: 'goto', pos: L.marinaCrate, radius: 5, text: 'Go to the marina crate on the beach' },
        { type: 'pickup', pos: L.marinaCrate, radius: 4, text: 'Press E to pick up the package' },
        { type: 'goto', pos: L.hideout, radius: 6, text: 'Bring the package back to the hideout' },
      ],
    },
    {
      def: MISSIONS[1],
      steps: [
        { type: 'goto', pos: new THREE.Vector3(60, 0, -60), radius: 6, text: 'Find the yellow Comet GT downtown' },
        { type: 'deliverCar', pos: L.garage, radius: 7, text: 'Drive the Comet GT to the garage' },
      ],
    },
    {
      def: MISSIONS[2],
      steps: [
        { type: 'follow', pos: null, radius: 0, text: 'Tail the courier van — stay 15 to 40m back' },
        { type: 'goto', pos: new THREE.Vector3(-120, 0, 120), radius: 6, text: 'Grab the briefcase where the van stops' },
      ],
    },
    {
      def: MISSIONS[3],
      steps: [
        { type: 'escape', pos: null, radius: 0, text: 'Lose the cops — stay out of sight until the heat dies' },
        { type: 'goto', pos: L.hideout, radius: 6, text: 'Get back to the hideout' },
      ],
    },
    {
      def: MISSIONS[4],
      steps: [
        { type: 'goto', pos: L.bank, radius: 7, text: 'Reach Coral Bank downtown' },
        { type: 'hold', pos: L.bank, radius: 6, duration: 5, text: 'Hold E at the vault to crack it' },
        { type: 'goto', pos: L.yacht, radius: 8, text: 'Escape to the yacht with the cash' },
      ],
    },
  ];
  return {
    defs: missionDefs,
    index: 0,
    stepIndex: 0,
    active: false,
    done: false,
    holdTimer: 0,
    followSpotted: false,
    followTimer: 0,
    // Set by main.js when the player picks up / delivers things.
    hasPackage: false,
    inTargetCar: false,
    targetPos() {
      if (!this.active || this.done) return null;
      const step = this.currentStep();
      if (!step) return null;
      if (step.type === 'follow') return world.courierVan ? world.courierVan.mesh.position : null;
      if (step.type === 'escape') return null;
      return step.pos;
    },
    currentStep() {
      if (this.index >= missionDefs.length) return null;
      const mission = missionDefs[this.index];
      return mission.steps[this.stepIndex] || null;
    },
    currentMission() {
      if (this.index >= missionDefs.length) return null;
      return missionDefs[this.index].def;
    },
    objectiveText() {
      if (this.done) return 'Neon Bay Legend — story complete!';
      if (!this.active) return 'Press Enter to start the next job';
      const step = this.currentStep();
      if (!step) return '';
      if (step.type === 'hold' && this.holdTimer > 0) {
        return `${step.text} (${Math.ceil(step.duration - this.holdTimer)}s)`;
      }
      return step.text;
    },
    start() {
      if (this.done || this.active) return false;
      this.active = true;
      this.stepIndex = 0;
      this.holdTimer = 0;
      this.followTimer = 0;
      return true;
    },
    // Called every frame. Returns an event: 'step', 'complete', 'failed' or null.
    update(dt, player, world, time) {
      if (!this.active || this.done) return null;
      const step = this.currentStep();
      if (!step) return null;
      const pos = player.pos;
      if (step.type === 'goto') {
        const d = Math.hypot(step.pos.x - pos.x, step.pos.z - pos.z);
        if (d < step.radius) return this.advance();
      } else if (step.type === 'pickup') {
        const d = Math.hypot(step.pos.x - pos.x, step.pos.z - pos.z);
        if (d < step.radius && player.pressedE) {
          this.hasPackage = true;
          return this.advance();
        }
      } else if (step.type === 'deliverCar') {
        if (!player.driving || !this.inTargetCar) return null;
        const d = Math.hypot(step.pos.x - pos.x, step.pos.z - pos.z);
        if (d < step.radius) return this.advance();
      } else if (step.type === 'follow') {
        const van = world.courierVan;
        if (!van) return null;
        const d = Math.hypot(van.mesh.position.x - pos.x, van.mesh.position.z - pos.z);
        if (d < 12) {
          this.followTimer += dt;
          if (this.followTimer > 2.5) {
            this.followSpotted = true;
            return 'failed';
          }
        } else {
          this.followTimer = Math.max(0, this.followTimer - dt);
        }
        this.followSpotted = false;
        if (van.arrived) return this.advance();
      } else if (step.type === 'escape') {
        if (world.police.wanted.stars === 0) return this.advance();
      } else if (step.type === 'hold') {
        const d = Math.hypot(step.pos.x - pos.x, step.pos.z - pos.z);
        if (d < step.radius && player.holdingE) {
          this.holdTimer += dt;
          if (this.holdTimer >= step.duration) return this.advance();
        } else {
          this.holdTimer = Math.max(0, this.holdTimer - dt * 2);
        }
      }
      return null;
    },
    advance() {
      this.stepIndex += 1;
      this.holdTimer = 0;
      const mission = missionDefs[this.index];
      if (this.stepIndex >= mission.steps.length) {
        const reward = mission.def.reward;
        this.index += 1;
        this.stepIndex = 0;
        this.active = false;
        this.hasPackage = false;
        this.inTargetCar = false;
        if (this.index >= missionDefs.length) {
          this.done = true;
        }
        return { event: 'complete', reward, title: mission.def.title };
      }
      return { event: 'step' };
    },
    fail() {
      this.active = false;
      this.stepIndex = 0;
      this.holdTimer = 0;
      this.followTimer = 0;
      this.hasPackage = false;
      return { event: 'failed' };
    },
    stepText,
  };
}
