// Neon Bay — keyboard and mouse input.
//
// One clear job: track which keys are held and which were just pressed, so
// the player, the driving and the menus all read the same input state.

export class Input {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.anyKey = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => {
      this.held.delete(e.code);
    };
    this._onMouseDown = (e) => {
      this.mouseDown = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
    };
    this._onBlur = () => {
      this.held.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.held.has(code);
  }

  // True once, on the frame the key went down. Consume it after reading.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  consume(code) {
    this.pressed.delete(code);
  }

  // WASD + arrows, merged into one steering/throttle pair.
  driveAxes() {
    const left = this.isDown('KeyA') || this.isDown('ArrowLeft');
    const right = this.isDown('KeyD') || this.isDown('ArrowRight');
    const up = this.isDown('KeyW') || this.isDown('ArrowUp');
    const down = this.isDown('KeyS') || this.isDown('ArrowDown');
    return {
      steer: (left ? 1 : 0) - (right ? 1 : 0),
      throttle: (up ? 1 : 0) - (down ? 1 : 0),
      boost: this.isDown('ShiftLeft') || this.isDown('ShiftRight'),
      brake: this.isDown('Space'),
    };
  }

  walkAxes() {
    const x = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0)
      - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    const z = (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0)
      - (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0);
    return { x, z, sprint: this.isDown('ShiftLeft') || this.isDown('ShiftRight') };
  }

  endFrame() {
    this.pressed.clear();
    this.anyKey = false;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
