// Neon Bay — HUD, minimap, menus, shops and dialogs. All DOM: health and
// armor bars, money, wanted stars, a live 2D minimap, mission hints, toasts,
// pause / settings / shop / wardrobe / dialogue panels.
import { OUTFITS, CONFIG } from './config.js';

export class HUD {
  constructor() {
    this.el = (id) => document.getElementById(id);
    this.minimap = this.el('minimap');
    this.mm = this.minimap.getContext('2d');
    this.minimapZoom = 1;
    this.onShopBuy = null;
    this.onOutfitBuy = null;
    this.onSettingsChange = null;
    this.onSettingsReset = null;
    this.onResume = null;
    this.onStart = null;
    this.onRetry = null;

    this.el('start-btn').addEventListener('click', () => this.onStart?.());
    this.el('resume-btn').addEventListener('click', () => this.onResume?.());
    this.el('save-btn').addEventListener('click', () => this.toast('Game saved.'));
    this.el('settings-btn').addEventListener('click', () => this.show('settings-screen'));
    this.el('settings-back').addEventListener('click', () => this.show('pause-screen'));
    this.el('settings-reset').addEventListener('click', () => this.onSettingsReset?.());
    this.el('shop-close').addEventListener('click', () => this.show(null));
    this.el('wardrobe-close').addEventListener('click', () => this.show(null));
    this.el('dialog-close').addEventListener('click', () => this.show(null));
    this.el('retry-btn').addEventListener('click', () => this.onRetry?.());

    document.querySelectorAll('#shop-screen [data-buy]').forEach((b) => {
      b.addEventListener('click', () => this.onShopBuy?.(b.dataset.buy));
    });

    // Settings controls.
    const vol = this.el('set-volume');
    vol.addEventListener('input', () => {
      this.el('set-volume-v').textContent = vol.value;
      this.onSettingsChange?.({ volume: vol.value / 100 });
    });
    const sens = this.el('set-sens');
    sens.addEventListener('input', () => {
      this.el('set-sens-v').textContent = sens.value;
      this.onSettingsChange?.({ sensitivity: sens.value / 100 });
    });
    this.el('set-quality').addEventListener('change', (e) => {
      this.onSettingsChange?.({ quality: e.target.value });
    });
    this.el('set-weather').addEventListener('change', (e) => {
      this.onSettingsChange?.({ weather: e.target.value });
    });

    // Wardrobe list.
    const list = this.el('outfit-list');
    OUTFITS.forEach((o, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span>${o.name} — $50</span>`;
      const btn = document.createElement('button');
      btn.textContent = 'WEAR';
      btn.addEventListener('click', () => this.onOutfitBuy?.(i));
      row.appendChild(btn);
      list.appendChild(row);
    });
  }

  show(screenId) {
    for (const id of ['start-screen', 'pause-screen', 'over-screen', 'settings-screen', 'shop-screen', 'wardrobe-screen', 'dialog-screen']) {
      this.el(id).style.display = id === screenId ? 'flex' : 'none';
    }
  }

  toast(msg, color = '#7dff9e') {
    const t = this.el('toast');
    t.textContent = msg;
    t.style.color = color;
    t.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, 2600);
  }

  hint(msg) {
    this.el('hint').textContent = msg;
  }

  update(state) {
    this.el('health-fill').style.width = `${Math.max(0, state.health)}%`;
    this.el('armor-fill').style.width = `${Math.max(0, state.armor)}%`;
    this.el('wanted').textContent = '★'.repeat(state.wanted) + '☆'.repeat(CONFIG.maxWanted - state.wanted);
    this.el('money').textContent = `$${state.money.toLocaleString()}`;
    // Weapon slots: [1 Pistol] [2 SMG] [3 Shotgun] with the current one
    // bracketed, then mag / reserve.
    const slotNames = ['Pistol', 'SMG', 'Shotgun'];
    const slots = slotNames.map((n, i) => (i === (state.weaponIndex ?? 1) ? `[${i + 1} ${n}]` : `${i + 1} ${n}`)).join('  ');
    this.el('weapon').textContent = `${slots} · ${state.ammo} / ${state.reserve}`;
    const mins = String(Math.floor(state.clockMinutes / 60) % 24).padStart(2, '0');
    const secs = String(Math.floor(state.clockMinutes % 60)).padStart(2, '0');
    this.el('clock').textContent = `${mins}:${secs}`;
    this.el('weather-label').textContent = state.weather === 'rain' ? '🌧 Rain' : '☀ Clear';
    this.el('mission-name').textContent = state.missionName;
    this.el('mission-text').textContent = state.missionText;
    this.el('speed').textContent = state.inVehicle ? `${Math.round(state.speed * 3.6)} km/h · ${state.vehicleName}` : '';
    this.el('crosshair').style.display = state.aiming && !state.inVehicle ? 'block' : 'none';
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    const g = this.mm, S = 168;
    const half = 280 / this.minimapZoom;
    const scale = S / (half * 2);
    const px = (x) => (x - state.player.x) * scale + S / 2;
    const pz = (z) => (z - state.player.z) * scale + S / 2;
    g.fillStyle = '#0a1226';
    g.fillRect(0, 0, S, S);
    // Roads: grid lines.
    g.strokeStyle = '#3a4356';
    g.lineWidth = 5;
    for (let i = -3; i <= 3; i++) {
      const c = i * 64;
      g.beginPath(); g.moveTo(px(c), 0); g.lineTo(px(c), S); g.stroke();
      g.beginPath(); g.moveTo(0, pz(c)); g.lineTo(S, pz(c)); g.stroke();
    }
    // Beach + ocean on the east edge.
    g.fillStyle = '#d9b380';
    g.fillRect(px(236), 0, S - px(236), S);
    g.fillStyle = '#0b3d66';
    g.fillRect(px(268), 0, S - px(268), S);
    // Marina basin.
    g.fillStyle = '#0b3d66';
    g.fillRect(px(145), pz(105), 110 * scale, 70 * scale);
    // Yellow route line from the player to the mission target.
    g.strokeStyle = '#ffd23e';
    g.lineWidth = 3;
    g.setLineDash([6, 4]);
    g.beginPath(); g.moveTo(px(state.player.x), pz(state.player.z)); g.lineTo(px(state.mission.x), pz(state.mission.z)); g.stroke();
    g.setLineDash([]);
    // Mission marker.
    g.fillStyle = '#ff2d78';
    g.beginPath(); g.arc(px(state.mission.x), pz(state.mission.z), 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(px(state.mission.x), pz(state.mission.z), 9, 0, Math.PI * 2); g.stroke();
    // Cops as red dots.
    g.fillStyle = '#ff2222';
    for (const c of state.cops) {
      g.beginPath(); g.arc(px(c.x), pz(c.z), 3.5, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    g.save();
    g.translate(px(state.player.x), pz(state.player.z));
    g.rotate(Math.atan2(Math.sin(state.player.yaw), Math.cos(state.player.yaw)) * -1 + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -8); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
  }

  showDialog(name, text) {
    this.el('dialog-name').textContent = name;
    this.el('dialog-text').textContent = text;
    this.show('dialog-screen');
  }
}
