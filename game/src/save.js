// Neon Bay — save and load.
//
// One clear job: persist the player's progress (money, missions cleared,
// crates found, best taxi fare) in localStorage, and read it back on boot.

const KEY = 'neon-bay-save-v1';

export function defaultSave() {
  return {
    money: 0,
    missionsDone: [],
    crates: [],
    bestFare: 0,
    totalEarned: 0,
    playSeconds: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage full or blocked — the game still plays, it just does not save.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
