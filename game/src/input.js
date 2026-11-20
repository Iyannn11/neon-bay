// Neon Bay input: keyboard, mouse-drag camera and touch controls.
// One object holds the whole input state; the game reads it every frame.

export function createInput(canvas) {
  const keys = Object.create(null);
  const state = {
    keys,
    // Camera orbit (radians) driven by mouse drag or touch drag.
    dragX: 0,
    dragY: 0,
    dragging: false,
    // Touch joystick (virtual): -1..1 on each axis while a touch is held.
    joyX: 0,
    joyY: 0,
    joyActive: false,
    // Edge-triggered actions, consumed by the game each frame.
    pressedE: false,
    pressedF: false,
    pressedR: false,
    pressedM: false,
    pressedEsc: false,
    clicked: false,
    clickX: 0,
    clickY: 0,
  };

  let lastX = 0;
  let lastY = 0;
  let joyId = null;
  let joyOriginX = 0;
  let joyOriginY = 0;

  function keyName(e) {
    return (e.key || '').toLowerCase();
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    keys[k] = true;
    if (k === 'e') state.pressedE = true;
    if (k === 'f') state.pressedF = true;
    if (k === 'r') state.pressedR = true;
    if (k === 'm') state.pressedM = true;
    if (k === 'escape' || k === 'p') state.pressedEsc = true;
    if (k === ' ' || k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[keyName(e)] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    state.dragging = false;
    state.joyActive = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    state.dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!state.dragging) return;
    state.dragX += e.clientX - lastX;
    state.dragY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    if (state.dragging && Math.abs(e.clientX - lastX) < 5 && Math.abs(e.clientY - lastY) < 5) {
      state.clicked = true;
      state.clickX = e.clientX;
      state.clickY = e.clientY;
    }
    state.dragging = false;
  });

  // Touch: left half is a virtual joystick, right half drags the camera.
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX < window.innerWidth / 2 && joyId === null) {
        joyId = t.identifier;
        joyOriginX = t.clientX;
        joyOriginY = t.clientY;
        state.joyActive = true;
      } else {
        state.dragging = true;
        lastX = t.clientX;
        lastY = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        state.joyX = Math.max(-1, Math.min(1, (t.clientX - joyOriginX) / 60));
        state.joyY = Math.max(-1, Math.min(1, (t.clientY - joyOriginY) / 60));
      } else if (state.dragging) {
        state.dragX += t.clientX - lastX;
        state.dragY += t.clientY - lastY;
        lastX = t.clientX;
        lastY = t.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null;
        state.joyX = 0;
        state.joyY = 0;
        state.joyActive = false;
      }
    }
    if (e.touches.length === 0) state.dragging = false;
  });

  // Driving helpers the game reads each frame.
  state.forward = function forward() {
    return (keys['w'] || keys['arrowup'] ? 1 : 0) - (keys['s'] || keys['arrowdown'] ? 1 : 0) - state.joyY;
  };
  state.steer = function steer() {
    return (keys['a'] || keys['arrowleft'] ? 1 : 0) - (keys['d'] || keys['arrowright'] ? 1 : 0) + state.joyX;
  };
  state.handbrake = function handbrake() {
    return keys[' '] === true;
  };
  // Clear the edge-triggered flags after the game has consumed them.
  state.consume = function consume() {
    state.pressedE = false;
    state.pressedF = false;
    state.pressedR = false;
    state.pressedM = false;
    state.pressedEsc = false;
    state.clicked = false;
    state.dragX = 0;
    state.dragY = 0;
  };
  return state;
}
