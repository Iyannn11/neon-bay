// save.js — Neon Bay's save file. One key in localStorage, plain JSON:
// cash, the missions finished, the best (highest) cash ever held and the total
// time played. Nothing else leaves the browser.

const KEY = 'neon-bay-save-v1';

export function blankSave() {
  return {
    cash: 0,
    missionsDone: [],
    bestCash: 0,
    secondsPlayed: 0,
    savedAt: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return blankSave();
    const data = JSON.parse(raw);
    const save = blankSave();
    if (typeof data.cash === 'number') save.cash = data.cash;
    if (Array.isArray(data.missionsDone)) save.missionsDone = data.missionsDone;
    if (typeof data.bestCash === 'number') save.bestCash = data.bestCash;
    if (typeof data.secondsPlayed === 'number') save.secondsPlayed = data.secondsPlayed;
    return save;
  } catch (err) {
    return blankSave();
  }
}

export function writeSave(save) {
  try {
    const copy = { ...save, savedAt: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(copy));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (err) {
    // Storage may be unavailable; the game still plays.
  }
}
