// Neon Bay — input: keyboard, pointer-lock mouse look, drag-to-look fallback
// (pointer lock can fail inside an iframe sandbox), and touch controls.
// Written fresh for Round 12.
export class Input {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    this.keys = {};
    this.locked = false;
    this.dragging = false;
    this.lastX = 0; this.lastY = 0;
    this.lookDX = 0; this.lookDY = 0;
    this.mouseDown = false;
    this.fired = false;
    this.pressed = new Set(); // edge-triggered keys, consumed by the game loop

    addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (!this.keys[e.code]) this.pressed.add(e.code);
      this.keys[e.code] = true;
      if (e.code === 'KeyM') game.toggleMissionList();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    canvas.addEventListener('click', () => {
      if (this.game.state !== 'playing') return;
      if (this.canvas.requestPointerLock) {
        try {
          const p = this.canvas.requestPointerLock();
          if (p && p.catch) p.catch(() => {});
        } catch (_) { /* pointer lock unavailable: drag-to-look covers it */ }
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.lookDX += e.movementX; this.lookDY += e.movementY;
      } else if (this.dragging) {
        this.lookDX += (e.clientX - this.lastX) * 1.6;
        this.lookDY += (e.clientY - this.lastY) * 1.6;
        this.lastX = e.clientX; this.lastY = e.clientY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.game.state !== 'playing') return;
      if (this.locked) {
        if (e.button === 0) this.fired = true;
        if (e.button === 2) this.game.player.aiming = true;
      } else {
        this.dragging = true;
        this.lastX = e.clientX; this.lastY = e.clientY;
        this.mouseDown = true;
        this.dragMoved = 0;
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 2) this.game.player.aiming = false;
      if (this.dragging) {
        // a short press without drag counts as a shot
        if ((this.dragMoved || 0) < 6 && this.mouseDown) this.fired = true;
        this.dragging = false; this.mouseDown = false;
      }
    });
    addEventListener('mousemove', (e) => {
      if (this.dragging) this.dragMoved = (this.dragMoved || 0) + Math.abs(e.movementX) + Math.abs(e.movementY);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // touch: left half = move stick, right half = drag look, buttons = actions
    this.touchMove = { x: 0, y: 0, active: false, id: null };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && this.touchMove.id === null) {
          this.touchMove.id = t.identifier;
          this.touchMove.active = true;
          this.touchMove.ox = t.clientX; this.touchMove.oy = t.clientY;
        } else {
          this.touchLookId = t.identifier;
          this.touchLX = t.clientX; this.touchLY = t.clientY;
        }
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.touchMove.id) {
          this.touchMove.x = (t.clientX - this.touchMove.ox) / 60;
          this.touchMove.y = (t.clientY - this.touchMove.oy) / 60;
        } else if (t.identifier === this.touchLookId) {
          this.lookDX += (t.clientX - this.touchLX) * 2.4;
          this.lookDY += (t.clientY - this.touchLY) * 2.4;
          this.touchLX = t.clientX; this.touchLY = t.clientY;
        }
      }
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touchMove.id) { this.touchMove.id = null; this.touchMove.active = false; this.touchMove.x = 0; this.touchMove.y = 0; }
        if (t.identifier === this.touchLookId) this.touchLookId = null;
      }
    });
  }

  consumeLook() {
    const dx = this.lookDX, dy = this.lookDY;
    this.lookDX = 0; this.lookDY = 0;
    return [dx, dy];
  }

  wasPressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }

  endFrame() { this.pressed.clear(); this.fired = false; }
}
