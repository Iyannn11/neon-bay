// Neon Bay — keyboard, mouse (pointer lock) and touch input in one place.
// The game reads `held` for continuous actions and consumes `pressed` edges once.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.rightDown = false;
    this.rightPressed = false;
    this.locked = false;
    this.sensitivity = 1.0;
    // Touch: virtual joystick (left) + action buttons wired from hud.js.
    this.joy = { active: false, x: 0, y: 0 };
    this.touch = { fire: false, jump: false, car: false, run: false, aim: false };
    this.touchPressed = { fire: false, jump: false, car: false };

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressedKeys.add(e.code);
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; this.rightDown = false; });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mousePressed = true; }
      if (e.button === 2) { this.rightDown = true; this.rightPressed = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  lockPointer() {
    if (!this.locked) {
      try { this.canvas.requestPointerLock(); } catch (e) { /* pointer lock unavailable */ }
    }
  }

  unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  held(code) { return this.keys.has(code); }

  // Edge-triggered: true once per physical press, then consumed by endFrame().
  pressed(code) { return this.pressedKeys.has(code); }
  mouseClicked() { return this.mousePressed; }
  rightClicked() { return this.rightPressed; }

  moveVector() {
    // Returns {x, z} in camera space: x = strafe right, z = forward.
    let x = 0, z = 0;
    if (this.held('KeyW') || this.held('ArrowUp')) z += 1;
    if (this.held('KeyS') || this.held('ArrowDown')) z -= 1;
    if (this.held('KeyA') || this.held('ArrowLeft')) x -= 1;
    if (this.held('KeyD') || this.held('ArrowRight')) x += 1;
    if (this.joy.active) { x += this.joy.x; z -= this.joy.y; }
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }

  sprinting() { return this.held('ShiftLeft') || this.held('ShiftRight') || this.touch.run; }
  aiming() { return this.rightDown || this.touch.aim; }
  firing() { return this.mouseDown || this.touch.fire; }

  consumeMouseDelta() {
    const dx = this.mouseDX * this.sensitivity;
    const dy = this.mouseDY * this.sensitivity;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() {
    this.pressedKeys.clear();
    this.mousePressed = false;
    this.rightPressed = false;
    this.touchPressed.fire = false;
    this.touchPressed.jump = false;
    this.touchPressed.car = false;
  }
}
