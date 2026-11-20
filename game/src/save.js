// Neon Bay save: a small JSON record in localStorage.
// Cash, missions completed, best cash. Nothing sensitive, nothing else.

const KEY = 'neon-bay-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { cash: 0, missionsDone: 0, bestCash: 0, muted: false };
    const data = JSON.parse(raw);
    return {
      cash: typeof data.cash === 'number' ? data.cash : 0,
      missionsDone: typeof data.missionsDone === 'number' ? data.missionsDone : 0,
      bestCash: typeof data.bestCash === 'number' ? data.bestCash : 0,
      muted: data.muted === true,
    };
  } catch (err) {
    return { cash: 0, missionsDone: 0, bestCash: 0, muted: false };
  }
}

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionsDone: state.missionsDone,
      bestCash: Math.max(state.bestCash || 0, state.cash),
      muted: state.muted === true,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    // Storage may be unavailable in a sandbox; the game plays on regardless.
  }
}
