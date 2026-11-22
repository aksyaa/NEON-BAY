// Keyboard and mouse input for Neon Bay v2. Held keys give a steering
// direction every frame; one-shot presses (enter car, shoot, pause,
// save, radio, horn) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice.
// Dragging the mouse orbits the camera; a left click also fires.
export const ACTION_ENTER = 1;
export const ACTION_SHOOT = 2;
export const ACTION_PAUSE = 4;
export const ACTION_CONFIRM = 8;
export const ACTION_RADIO = 16;
export const ACTION_SAVE = 32;
export const ACTION_HORN = 64;

// One table drives everything: which physical keys belong to which
// held direction, and which one-shot key raises which action bit.
const HELD_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  drift: ['Space'],
};

const PRESS_KEYS = {
  KeyF: ACTION_ENTER,
  KeyJ: ACTION_SHOOT,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  KeyR: ACTION_RADIO,
  KeyG: ACTION_SAVE,
  KeyH: ACTION_HORN,
};

const SCROLL_KEYS = new Set([
  ...HELD_KEYS.forward,
  ...HELD_KEYS.back,
  ...HELD_KEYS.left,
  ...HELD_KEYS.right,
  ...HELD_KEYS.drift,
]);

export function createInput(target) {
  const held = new Set();
  let queued = 0;
  let dragX = 0;
  let dragY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (SCROLL_KEYS.has(event.code)) event.preventDefault();
      return;
    }
    held.add(event.code);
    const bit = PRESS_KEYS[event.code];
    if (bit !== undefined) queued |= bit;
    if (SCROLL_KEYS.has(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    dragging = false;
  });

  target.addEventListener('pointerdown', (event) => {
    if (event.button === 0) queued |= ACTION_SHOOT;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    dragX += event.clientX - lastX;
    dragY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
  });

  const anyHeld = (names) => names.some((code) => held.has(code));

  return {
    has(code) {
      return held.has(code);
    },
    forward() {
      return anyHeld(HELD_KEYS.forward) ? 1 : 0;
    },
    back() {
      return anyHeld(HELD_KEYS.back) ? 1 : 0;
    },
    steer() {
      return (anyHeld(HELD_KEYS.right) ? 1 : 0) - (anyHeld(HELD_KEYS.left) ? 1 : 0);
    },
    run() {
      return anyHeld(HELD_KEYS.run);
    },
    drift() {
      return anyHeld(HELD_KEYS.drift);
    },
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
    takeDrag() {
      const d = { x: dragX, y: dragY };
      dragX = 0;
      dragY = 0;
      return d;
    },
  };
}
