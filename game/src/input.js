// Neon Bay — keyboard, mouse (pointer lock), and touch input. One state
// object the game reads every frame; touch buttons feed the same state.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.forward = false; this.back = false; this.left = false; this.right = false;
    this.sprint = false; this.jump = false;
    this.mouseDX = 0; this.mouseDY = 0;
    this.mouseDown = false; this.aimDown = false;
    this.locked = false;
    this.stick = { x: 0, y: 0, active: false };
    this.onAction = null; // (action) => {} — E, R, F, V, 1/2/3, Esc, M
    this.onPause = null;
    this.onAnyKey = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      this.syncKeys();
      if (this.onAnyKey) this.onAnyKey();
      const map = {
        KeyE: 'enter', KeyR: 'reload', KeyF: 'taxi', KeyV: 'weather',
        Digit1: 'weapon1', Digit2: 'weapon2', Digit3: 'weapon3',
        KeyM: 'minimap', Escape: 'pause',
      };
      if (map[e.code] && this.onAction) this.onAction(map[e.code]);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this.syncKeys();
    });
    canvas.addEventListener('click', () => {
      if (!this.locked && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.aimDown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.aimDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch: virtual joystick + action buttons feed the same state.
    if ('ontouchstart' in window) {
      document.getElementById('touch-ui').style.display = 'block';
      this.bindStick();
      this.bindButton('btn-shoot', (down) => { this.mouseDown = down; });
      this.bindButton('btn-car', (down) => { if (down && this.onAction) this.onAction('enter'); });
      this.bindButton('btn-jump', (down) => { this.jumpTouch = down; this.syncKeys(); });
      this.bindButton('btn-run', (down) => { this.sprintTouch = down; this.syncKeys(); });
      this.bindButton('btn-pause', (down) => { if (down && this.onAction) this.onAction('pause'); });
    }
  }

  syncKeys() {
    this.forward = !!this.keys.KeyW || !!this.keys.ArrowUp || this.stick.y < -0.25;
    this.back = !!this.keys.KeyS || !!this.keys.ArrowDown || this.stick.y > 0.25;
    this.left = !!this.keys.KeyA || !!this.keys.ArrowLeft || this.stick.x < -0.25;
    this.right = !!this.keys.KeyD || !!this.keys.ArrowRight || this.stick.x > 0.25;
    this.sprint = !!this.keys.ShiftLeft || !!this.keys.ShiftRight || !!this.sprintTouch;
    this.jump = !!this.keys.Space || !!this.jumpTouch;
  }

  bindStick() {
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stick-knob');
    let id = null;
    const move = (e) => {
      const t = [...e.changedTouches].find((x) => x.identifier === id);
      if (!t) return;
      const r = stick.getBoundingClientRect();
      let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.stick.x = dx; this.stick.y = dy;
      knob.style.left = `${34 + dx * 30}px`;
      knob.style.top = `${34 + dy * 30}px`;
      this.syncKeys();
    };
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      id = e.changedTouches[0].identifier;
      this.stick.active = true;
      move(e);
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); }, { passive: false });
    const end = (e) => {
      if ([...e.changedTouches].some((x) => x.identifier === id)) {
        id = null;
        this.stick.x = 0; this.stick.y = 0; this.stick.active = false;
        knob.style.left = '34px'; knob.style.top = '34px';
        this.syncKeys();
      }
    };
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);
  }

  bindButton(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(true); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); fn(false); }, { passive: false });
    el.addEventListener('mousedown', () => fn(true));
    el.addEventListener('mouseup', () => fn(false));
  }

  // Consume accumulated mouse movement for this frame.
  takeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
}
