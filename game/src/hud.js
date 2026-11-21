// Neon Bay — everything drawn on top of the 3D view: health/armor/cash/wanted
// HUD, a live 2D minimap, interaction prompts, NPC dialogue, the AMMU-NATION
// shop, toasts, banners, and the touch controls (joystick + action buttons).

import { WEAPONS } from './config.js';

const ROADS = [-256, -192, -128, -64, 0, 64, 128, 192, 256];

export class HUD {
  constructor(input, cb) {
    this.input = input;
    this.cb = cb; // {buy(item), closeShop, resume, restart, start, settings(s), resetSave, pause}
    this.el = (id) => document.getElementById(id);
    this.map = this.el('minimap');
    this.mapCtx = this.map ? this.map.getContext('2d') : null;
    this._toastTimer = null;
    this._wireTouch();
    this._wireMenus();
  }

  _wireMenus() {
    const on = (id, fn) => { const e = this.el(id); if (e) e.addEventListener('click', fn); };
    on('start-btn', () => this.cb.start());
    on('resume-btn', () => this.cb.resume());
    on('restart-btn', () => this.cb.restart());
    on('quit-btn', () => this.cb.resume());
    on('gameover-btn', () => this.cb.restart());
    on('shop-close', () => this.cb.closeShop());
    on('buy-health', () => this.cb.buy('health'));
    on('buy-armor', () => this.cb.buy('armor'));
    on('buy-ammo', () => this.cb.buy('ammo'));
    on('dialogue-close', () => this.hideDialogue());
    const vol = this.el('vol-slider');
    if (vol) vol.addEventListener('input', () => this.cb.settings({ volume: vol.value / 100 }));
    const sens = this.el('sens-slider');
    if (sens) sens.addEventListener('input', () => this.cb.settings({ sensitivity: sens.value / 100 }));
    const q = this.el('quality-select');
    if (q) q.addEventListener('change', () => this.cb.settings({ quality: q.value }));
    const w = this.el('weather-toggle');
    if (w) w.addEventListener('change', () => this.cb.settings({ weather: w.value }));
    const r = this.el('reset-save');
    if (r) r.addEventListener('click', () => this.cb.resetSave());
  }

  _wireTouch() {
    const joy = this.el('joystick');
    const knob = this.el('joy-knob');
    if (!joy || !knob) return;
    const setJoy = (t) => {
      const rect = joy.getBoundingClientRect();
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
      let dx = (t.clientX - cx) / (rect.width / 2);
      let dy = (t.clientY - cy) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this.input.joy = { active: true, x: dx, y: dy };
      knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
    };
    joy.addEventListener('touchstart', (e) => { e.preventDefault(); setJoy(e.touches[0]); }, { passive: false });
    joy.addEventListener('touchmove', (e) => { e.preventDefault(); setJoy(e.touches[0]); }, { passive: false });
    const endJoy = () => {
      this.input.joy = { active: false, x: 0, y: 0 };
      knob.style.transform = 'translate(0px, 0px)';
    };
    joy.addEventListener('touchend', endJoy);
    joy.addEventListener('touchcancel', endJoy);
    const bindBtn = (id, key) => {
      const b = this.el(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.input.touch[key] = true;
        this.input.touchPressed[key] = true;
        b.classList.add('active');
      }, { passive: false });
      const off = () => { this.input.touch[key] = false; b.classList.remove('active'); };
      b.addEventListener('touchend', off);
      b.addEventListener('touchcancel', off);
    };
    bindBtn('btn-fire', 'fire');
    bindBtn('btn-jump', 'jump');
    bindBtn('btn-car', 'car');
    bindBtn('btn-run', 'run');
    bindBtn('btn-aim', 'aim');
    const pause = this.el('btn-pause');
    if (pause) pause.addEventListener('click', () => this.cb.pause());
  }

  show(id) { const e = this.el(id); if (e) e.classList.remove('hidden'); }
  hide(id) { const e = this.el(id); if (e) e.classList.add('hidden'); }

  setScreen(name) {
    const screens = ['start-screen', 'pause-screen', 'gameover-screen'];
    for (const s of screens) this.hide(s);
    if (name === 'start') this.show('start-screen');
    if (name === 'paused') this.show('pause-screen');
    if (name === 'gameover') this.show('gameover-screen');
    const hud = this.el('hud');
    if (hud) hud.classList.toggle('hidden', name !== 'playing');
    const touch = this.el('touch-ui');
    if (touch) touch.classList.toggle('hidden', name !== 'playing' || !('ontouchstart' in window));
  }

  update(s) {
    // s: {health, armor, cash, wanted, weapon, ammo, mag, vehicle, speedKmh, missionText, timeLabel}
    const setW = (id, pct) => { const e = this.el(id); if (e) e.style.width = `${Math.max(0, Math.min(100, pct))}%`; };
    setW('health-fill', s.health);
    setW('armor-fill', s.armor);
    const cash = this.el('cash');
    if (cash) cash.textContent = `$${Math.floor(s.cash).toLocaleString('en-US')}`;
    const wanted = this.el('wanted');
    if (wanted) {
      wanted.textContent = '★'.repeat(s.wanted) + '☆'.repeat(Math.max(0, 5 - s.wanted));
      wanted.classList.toggle('hot', s.wanted >= 3);
    }
    const wn = this.el('weapon-name');
    if (wn) wn.textContent = WEAPONS[s.weapon].name;
    const am = this.el('ammo');
    if (am) am.textContent = `${s.mag} / ${s.ammo}`;
    const vc = this.el('vehicle-panel');
    if (vc) {
      vc.classList.toggle('hidden', !s.vehicle);
      if (s.vehicle) {
        setW('cond-fill', s.vehicle.condition);
        const sp = this.el('speed');
        if (sp) sp.textContent = `${Math.round(s.speedKmh)} km/h`;
        const vn = this.el('vehicle-name');
        if (vn) vn.textContent = s.vehicle.label;
      }
    }
    const mt = this.el('mission-text');
    if (mt) mt.textContent = s.missionText || '';
    const tl = this.el('time-label');
    if (tl) tl.textContent = s.timeLabel || '';
  }

  drawMinimap(player, world, markers, cops, missionMarker) {
    if (!this.mapCtx) return;
    const ctx = this.mapCtx;
    const S = this.map.width;
    const toMap = (x, z) => [(x + 320) * (S / 640), (z + 320) * (S / 640)];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, S, S);
    // water + beach
    const [wx] = toMap(300, 0);
    ctx.fillStyle = '#0a4a6b';
    ctx.fillRect(wx, 0, S - wx, S);
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(toMap(256, 0)[0], 0, wx - toMap(256, 0)[0], S);
    // roads
    ctx.strokeStyle = '#4a4f5a';
    ctx.lineWidth = 3;
    for (const r of ROADS) {
      const [x1] = toMap(r, -320); const [, y1] = toMap(-320, r);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(S, y1); ctx.stroke();
    }
    // highway ring
    ctx.strokeStyle = '#c8ccd4';
    ctx.lineWidth = 2;
    const [rx, ry] = toMap(-288, -288);
    ctx.strokeRect(rx, ry, 576 * (S / 640), 576 * (S / 640));
    // shops
    const dot = (x, z, color, r = 3) => {
      const [mx, my] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.fill();
    };
    if (markers) {
      if (markers.ammu) dot(markers.ammu.x, markers.ammu.z, '#39d98a');
      if (markers.spray) dot(markers.spray.x, markers.spray.z, '#ff9d2e');
      if (markers.threads) dot(markers.threads.x, markers.threads.z, '#ff2e88');
      if (markers.taxi) dot(markers.taxi.x, markers.taxi.z, '#ffe14d');
      if (markers.marina) dot(markers.marina.x, markers.marina.z, '#00e5ff');
    }
    if (world) {
      for (const c of world.crates) if (!c.taken) dot(c.x, c.z, '#ff2e88', 2);
    }
    if (cops) for (const c of cops) {
      const v = c.vehicle.group.position;
      dot(v.x, v.z, '#ff3344', 3);
    }
    // mission marker (pulsing yellow diamond)
    if (missionMarker) {
      const [mx, my] = toMap(missionMarker.x, missionMarker.z);
      const pulse = 4 + Math.sin(performance.now() * 0.006) * 1.5;
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse); ctx.lineTo(mx + pulse, my);
      ctx.lineTo(mx, my + pulse); ctx.lineTo(mx - pulse, my);
      ctx.closePath(); ctx.fill();
    }
    // player arrow: heading is atan2(x, z); canvas y runs down with +z, so the
    // arrow (drawn pointing up) needs rotation PI - heading.
    const [px, py] = toMap(player.pos.x, player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  showPrompt(text) {
    const e = this.el('prompt');
    if (!e) return;
    e.textContent = text;
    e.classList.remove('hidden');
  }

  hidePrompt() { const e = this.el('prompt'); if (e) e.classList.add('hidden'); }

  showDialogue(name, line) {
    const d = this.el('dialogue');
    if (!d) return;
    const n = this.el('dialogue-name');
    const t = this.el('dialogue-text');
    if (n) n.textContent = name;
    if (t) t.textContent = line;
    d.classList.remove('hidden');
  }

  hideDialogue() { const e = this.el('dialogue'); if (e) e.classList.add('hidden'); }

  showShop(cash) {
    const s = this.el('shop');
    if (!s) return;
    const c = this.el('shop-cash');
    if (c) c.textContent = `$${Math.floor(cash)}`;
    s.classList.remove('hidden');
  }

  hideShop() { const e = this.el('shop'); if (e) e.classList.add('hidden'); }

  toast(text) {
    const box = this.el('toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 3600);
  }

  banner(title, sub) {
    const b = this.el('banner');
    if (!b) return;
    const t = this.el('banner-title');
    const s = this.el('banner-sub');
    if (t) t.textContent = title;
    if (s) s.textContent = sub || '';
    b.classList.remove('hidden');
    b.classList.remove('banner-pop');
    void b.offsetWidth; // restart the animation
    b.classList.add('banner-pop');
    clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => b.classList.add('hidden'), 3200);
  }
}
