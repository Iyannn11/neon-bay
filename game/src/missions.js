// missions.js — Neon Bay's six-mission chain. A mission is a list of steps;
// the system watches the player's position, car and actions, advances the
// step when its condition is met, and pays the reward on completion. The HUD
// reads the current step's label, and a beacon marks the target in the world.

import { MISSIONS } from './config.js';

export class MissionSystem {
  constructor(onEvent) {
    this.onEvent = onEvent; // (kind, data) — 'step', 'complete', 'fail'
    this.index = 0;
    this.stepIndex = 0;
    this.holdProgress = 0;
    this.holding = false;
    this.done = [];
    this.followTarget = null;
    this.escaped = false;
  }

  current() {
    return MISSIONS[this.index] || null;
  }

  currentStep() {
    const m = this.current();
    if (!m) return null;
    return m.steps[this.stepIndex] || null;
  }

  // The world position the player should head for right now.
  targetPos() {
    const step = this.currentStep();
    if (!step) return null;
    return step.at;
  }

  start(index = 0) {
    this.index = index;
    this.stepIndex = 0;
    this.holdProgress = 0;
    this.holding = false;
    this.escaped = false;
  }

  _advance() {
    this.stepIndex += 1;
    this.holdProgress = 0;
    this.holding = false;
    const mission = this.current();
    if (this.stepIndex >= mission.steps.length) {
      this.done.push(mission.id);
      this.onEvent('complete', { mission });
      this.index += 1;
      this.stepIndex = 0;
      const next = this.current();
      if (next) this.onEvent('step', { mission: next, step: next.steps[0] });
      else this.onEvent('chainComplete', {});
    } else {
      this.onEvent('step', { mission, step: mission.steps[this.stepIndex] });
    }
  }

  // Called every frame with the live game state.
  // state: { x, z, inCar, car, wanted, holdingE, dt, courierPos, courierHeading, police }
  update(state) {
    const step = this.currentStep();
    if (!step) return;
    const dx = state.x - step.at[0];
    const dz = state.z - step.at[1];
    const dist = Math.hypot(dx, dz);

    if (step.type === 'goto') {
      if (dist < step.radius) this._advance();
      return;
    }
    if (step.type === 'pickup') {
      if (dist < step.radius && state.pressedE) this._advance();
      return;
    }
    if (step.type === 'deliverCar') {
      if (state.inCar && dist < step.radius && state.car) {
        const speed = Math.abs(state.car.speed || 0);
        if (speed < 3) this._advance();
      }
      return;
    }
    if (step.type === 'follow') {
      // Stay inside the tail zone (radius) and never closer than 8 m.
      if (state.courierPos) {
        const cd = Math.hypot(state.x - state.courierPos.x, state.z - state.courierPos.z);
        if (cd > step.radius + 14) {
          this.onEvent('fail', { reason: 'You lost the courier.' });
          this.stepIndex = 0;
          this.holdProgress = 0;
          return;
        }
        if (cd < 8) {
          this.onEvent('fail', { reason: 'The courier spotted you — too close!' });
          this.stepIndex = 0;
          this.holdProgress = 0;
          return;
        }
        // Hold the tail for 20 seconds of clean following.
        this.holdProgress += state.dt;
        if (this.holdProgress >= 20) this._advance();
      }
      return;
    }
    if (step.type === 'escape') {
      if (state.wanted < 1) this.escaped = true;
      if (this.escaped && dist < step.radius) this._advance();
      return;
    }
    if (step.type === 'hold') {
      if (dist < step.radius && state.holdingE) {
        this.holding = true;
        this.holdProgress += state.dt;
        if (this.holdProgress >= step.seconds) this._advance();
      } else {
        this.holding = false;
        // Progress decays when the player lets go or steps away.
        this.holdProgress = Math.max(0, this.holdProgress - state.dt * 0.5);
      }
      return;
    }
  }
}
