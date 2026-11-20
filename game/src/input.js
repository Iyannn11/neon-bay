// input.js — keyboard, mouse and touch input for Neon Bay.
// One Input object owns the whole state: which keys are held, the camera drag,
// and the touch buttons. The game reads it once a frame; nothing else touches
// the DOM listeners.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mouseClicked = false;
    this.dragX = 0;
    this.dragY = 0;
    this.touch = { steer: 0, gas: false, brake: false, action: false };
    this._lastX = 0;
    this._lastY = 0;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) return;
      this.keys.add(ev.code);
      this.pressed.add(ev.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) {
        ev.preventDefault();
      }
    });
    window.addEventListener('keyup', (ev) => {
      this.keys.delete(ev.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    this.canvas.addEventListener('mousedown', (ev) => {
      this.mouseDown = true;
      this.mouseClicked = true;
      this._lastX = ev.clientX;
      this._lastY = ev.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    window.addEventListener('mousemove', (ev) => {
      if (!this.mouseDown) return;
      this.dragX += ev.clientX - this._lastX;
      this.dragY += ev.clientY - this._lastY;
      this._lastX = ev.clientX;
      this._lastY = ev.clientY;
    });
    // Touch: left half steers, right half is gas/brake/action.
    this.canvas.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
      this._touchMove(ev);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (ev) => {
      ev.preventDefault();
      this._touchMove(ev);
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => {
      this.touch.steer = 0;
      this.touch.gas = false;
      this.touch.brake = false;
      this.touch.action = false;
    });
  }

  _touchMove(ev) {
    const rect = this.canvas.getBoundingClientRect();
    for (const t of ev.touches) {
      const x = (t.clientX - rect.left) / rect.width;
      const y = (t.clientY - rect.top) / rect.height;
      if (x < 0.5) {
        this.touch.steer = x < 0.25 ? -1 : 1;
      } else if (y < 0.5) {
        this.touch.gas = true;
      } else if (x < 0.75) {
        this.touch.brake = true;
      } else {
        this.touch.action = true;
      }
    }
  }

  // True while the key is held.
  held(code) {
    return this.keys.has(code) || this._touchKey(code);
  }

  // True only on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code) || (code === 'KeyE' && this.touch.action);
  }

  _touchKey(code) {
    if (code === 'KeyW' || code === 'ArrowUp') return this.touch.gas;
    if (code === 'KeyS' || code === 'ArrowDown') return this.touch.brake;
    if (code === 'KeyA' || code === 'ArrowLeft') return this.touch.steer < 0;
    if (code === 'KeyD' || code === 'ArrowRight') return this.touch.steer > 0;
    return false;
  }

  // Steering: -1 (left) to +1 (right), from keys or touch.
  steerAxis() {
    let s = 0;
    if (this.held('KeyA') || this.held('ArrowLeft')) s -= 1;
    if (this.held('KeyD') || this.held('ArrowRight')) s += 1;
    return s;
  }

  // Throttle: +1 forward, -1 reverse/brake.
  throttleAxis() {
    let t = 0;
    if (this.held('KeyW') || this.held('ArrowUp')) t += 1;
    if (this.held('KeyS') || this.held('ArrowDown')) t -= 1;
    return t;
  }

  // Call at the end of every frame: clears one-frame edges.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.dragX = 0;
    this.dragY = 0;
    this.touch.action = false;
  }
}
