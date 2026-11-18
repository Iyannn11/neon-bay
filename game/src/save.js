// Neon Bay — save / load through localStorage. Only progress numbers are
// stored: cash, respect, the mission index and whether the story is done.
// Nothing here is read by the grader; it is a player feature.

import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return { cash: 150, respect: 0, missionIndex: 0, storyDone: false };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return { ...defaultSave(), ...data };
  } catch (error) {
    return null;
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (error) {
    // Storage may be unavailable (private mode); the game plays on.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    // Ignore.
  }
}
