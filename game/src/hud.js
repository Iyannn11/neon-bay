// Neon Bay — HUD, minimap and menu screens.
// All DOM lives in index.html; this module owns updating it. The minimap is
// a 2D canvas: roads, blocks, beach, the player arrow, police blips, the
// mission star and traffic dots.

import { WORLD } from './config.js';

function el(id) {
  return document.getElementById(id);
}

export function createHud() {
  const minimap = el('minimap');
  const mapCtx = minimap ? minimap.getContext('2d') : null;
  let toastTimer = null;
  let lastMapDraw = 0;
  let bannerTimer = null;

  function setStars(stars) {
    const starsEl = el('stars');
    if (!starsEl) return;
    let text = '';
    for (let i = 0; i < 5; i += 1) text += i < stars ? '★' : '☆';
    starsEl.textContent = text;
    starsEl.className = stars > 0 ? 'stars hot' : 'stars';
  }

  return {
    showTitle(saveExists) {
      const screen = el('title-screen');
      if (screen) screen.classList.remove('hidden');
      const cont = el('btn-continue');
      if (cont) cont.style.display = saveExists ? 'inline-block' : 'none';
      const hud = el('hud');
      if (hud) hud.classList.add('hidden');
    },
    hideTitle() {
      const screen = el('title-screen');
      if (screen) screen.classList.add('hidden');
      const hud = el('hud');
      if (hud) hud.classList.remove('hidden');
    },
    showPause() {
      const screen = el('pause-screen');
      if (screen) screen.classList.remove('hidden');
    },
    hidePause() {
      const screen = el('pause-screen');
      if (screen) screen.classList.add('hidden');
    },
    showGameOver(title, text) {
      const screen = el('gameover-screen');
      if (screen) screen.classList.remove('hidden');
      const titleEl = el('gameover-title');
      if (titleEl) titleEl.textContent = title;
      const textEl = el('gameover-text');
      if (textEl) textEl.textContent = text;
      const hud = el('hud');
      if (hud) hud.classList.add('hidden');
    },
    hideGameOver() {
      const screen = el('gameover-screen');
      if (screen) screen.classList.add('hidden');
      const hud = el('hud');
      if (hud) hud.classList.remove('hidden');
    },
    showMissionBanner(title, reward) {
      const banner = el('mission-banner');
      if (!banner) return;
      const titleEl = el('mission-banner-title');
      if (titleEl) titleEl.textContent = `Job done: ${title}`;
      const rewardEl = el('mission-banner-reward');
      if (rewardEl) rewardEl.textContent = `+$${reward}`;
      banner.classList.remove('hidden');
      if (bannerTimer) window.clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => banner.classList.add('hidden'), 3500);
    },
    showStoryComplete() {
      const banner = el('mission-banner');
      if (!banner) return;
      const titleEl = el('mission-banner-title');
      if (titleEl) titleEl.textContent = 'NEON BAY LEGEND — story complete!';
      const rewardEl = el('mission-banner-reward');
      if (rewardEl) rewardEl.textContent = 'Kai Reyes owns the Bay.';
      banner.classList.remove('hidden');
    },
    toast(text) {
      const toastEl = el('toast');
      if (!toastEl) return;
      toastEl.textContent = text;
      toastEl.classList.remove('hidden');
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), 3200);
    },
    flashDamage() {
      const flash = el('damage-flash');
      if (!flash) return;
      flash.classList.remove('hidden');
      window.setTimeout(() => flash.classList.add('hidden'), 180);
    },
    setMuzzleFlash() {
      const flash = el('muzzle-flash');
      if (!flash) return;
      flash.classList.remove('hidden');
      window.setTimeout(() => flash.classList.add('hidden'), 60);
    },
    // Point the edge arrow at an off-screen objective. angle in radians
    // (screen space, 0 = right); fx/fy place it near the screen edge.
    setArrow(angle, visible, fx, fy) {
      const arrow = el('objective-arrow');
      if (!arrow) return;
      if (!visible) {
        arrow.classList.add('hidden');
        return;
      }
      arrow.classList.remove('hidden');
      arrow.style.left = `${(fx === undefined ? 0.5 : fx) * 100}%`;
      arrow.style.top = `${(fy === undefined ? 0.5 : fy) * 100}%`;
      arrow.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    },
    update(state) {
      const healthFill = el('health-fill');
      if (healthFill) {
        const pct = Math.max(0, Math.min(100, (state.health / state.maxHealth) * 100));
        healthFill.style.width = `${pct}%`;
        healthFill.className = pct < 30 ? 'low' : '';
        healthFill.id = 'health-fill';
      }
      const cashEl = el('cash');
      if (cashEl) cashEl.textContent = `$${state.cash.toLocaleString('en-US')}`;
      setStars(state.stars);
      const speedEl = el('speed');
      if (speedEl) speedEl.textContent = state.driving ? `${Math.round(state.speedKmh)} km/h` : '';
      const clockEl = el('clock');
      if (clockEl) clockEl.textContent = state.clock;
      const missionTitle = el('mission-title');
      if (missionTitle) missionTitle.textContent = state.missionTitle || 'NEON BAY — free roam';
      const objective = el('mission-objective');
      if (objective) objective.textContent = state.objective || '';
      const ammoEl = el('ammo');
      if (ammoEl) {
        ammoEl.textContent = state.hasPistol
          ? (state.reloading ? 'RELOADING…' : `Pistol ${state.ammo} / 12`)
          : 'Fists — press 2 for pistol';
      }
      const crosshair = el('crosshair');
      if (crosshair) crosshair.classList.toggle('hidden', !state.hasPistol);
      const wantedLabel = el('wanted-label');
      if (wantedLabel) {
        wantedLabel.textContent = state.stars > 0 ? 'WANTED — lose the cops!' : '';
      }
      // Minimap at ~10 Hz.
      const now = performance.now();
      if (mapCtx && now - lastMapDraw > 100) {
        lastMapDraw = now;
        this.drawMinimap(state);
      }
    },
    drawMinimap(state) {
      const size = 168;
      const scale = size / 560;
      const toMap = (x, z) => [(x + 280) * scale, (z + 280) * scale];
      mapCtx.clearRect(0, 0, size, size);
      mapCtx.fillStyle = '#0d2f45';
      mapCtx.fillRect(0, 0, size, size);
      // Ocean strip at the bottom (south).
      mapCtx.fillStyle = '#1d6f9e';
      const [, oceanY] = toMap(0, 262);
      mapCtx.fillRect(0, oceanY, size, size - oceanY);
      // Sand.
      mapCtx.fillStyle = '#e8d29a';
      const [, sandY] = toMap(0, 212);
      mapCtx.fillRect(0, sandY, size, oceanY - sandY);
      // City blocks.
      mapCtx.fillStyle = '#3d4450';
      mapCtx.fillRect(0, 0, size, sandY);
      // Roads.
      mapCtx.strokeStyle = '#565e6a';
      mapCtx.lineWidth = 5;
      for (const road of WORLD.roads) {
        const [rx] = toMap(road, 0);
        const [, rz] = toMap(0, road);
        mapCtx.beginPath();
        mapCtx.moveTo(rx, 0);
        mapCtx.lineTo(rx, sandY);
        mapCtx.stroke();
        mapCtx.beginPath();
        mapCtx.moveTo(0, rz);
        mapCtx.lineTo(size, rz);
        mapCtx.stroke();
      }
      // Landmarks.
      mapCtx.font = 'bold 11px sans-serif';
      mapCtx.textAlign = 'center';
      const marks = [
        [state.landmarks.hideout, 'H', '#4a7fb8'],
        [state.landmarks.garage, 'G', '#d8a920'],
        [state.landmarks.bank, '$', '#ffd400'],
        [state.landmarks.yacht, 'Y', '#ffffff'],
      ];
      for (const [pos, letter, colour] of marks) {
        const [mx, my] = toMap(pos.x, pos.z);
        mapCtx.fillStyle = colour;
        mapCtx.fillRect(mx - 6, my - 6, 12, 12);
        mapCtx.fillStyle = '#111111';
        mapCtx.fillText(letter, mx, my + 4);
      }
      // Traffic dots.
      mapCtx.fillStyle = '#9aa0a8';
      for (const pos of state.trafficPositions || []) {
        const [mx, my] = toMap(pos.x, pos.z);
        mapCtx.fillRect(mx - 1, my - 1, 2, 2);
      }
      // Mission star.
      if (state.missionTarget) {
        const [mx, my] = toMap(state.missionTarget.x, state.missionTarget.z);
        mapCtx.fillStyle = '#ffd400';
        mapCtx.beginPath();
        mapCtx.arc(mx, my, 6, 0, Math.PI * 2);
        mapCtx.fill();
        mapCtx.fillStyle = '#111111';
        mapCtx.font = 'bold 9px sans-serif';
        mapCtx.fillText('!', mx, my + 3);
      }
      // Police blips.
      mapCtx.fillStyle = '#ff2e2e';
      for (const pos of state.policePositions || []) {
        const [mx, my] = toMap(pos.x, pos.z);
        mapCtx.beginPath();
        mapCtx.arc(mx, my, 3.5, 0, Math.PI * 2);
        mapCtx.fill();
      }
      // Player arrow.
      const [px, py] = toMap(state.playerPos.x, state.playerPos.z);
      mapCtx.save();
      mapCtx.translate(px, py);
      mapCtx.rotate(Math.PI - state.playerHeading);
      mapCtx.fillStyle = '#ffffff';
      mapCtx.strokeStyle = '#111111';
      mapCtx.lineWidth = 1;
      mapCtx.beginPath();
      mapCtx.moveTo(0, -7);
      mapCtx.lineTo(5, 6);
      mapCtx.lineTo(0, 3);
      mapCtx.lineTo(-5, 6);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.stroke();
      mapCtx.restore();
    },
  };
}
