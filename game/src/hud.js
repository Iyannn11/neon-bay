// Neon Bay — HUD: health/armour bars, wanted stars, cash, clock, weapon slots,
// mission card, toast messages, and a live 2D minimap with a route line.
// Written fresh for Round 12.
import { WEAPONS } from './config.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['health', 'armor', 'cash', 'clock', 'weather', 'mission', 'missionBrief', 'toast', 'stars', 'weapons', 'speed', 'prompt', 'minimap', 'center']) {
      this.el[id] = document.getElementById(id);
    }
    this.map = this.el.minimap ? this.el.minimap.getContext('2d') : null;
    this.toastTimer = 0;
  }

  setMission(name, brief) {
    if (this.el.mission) this.el.mission.textContent = name;
    if (this.el.missionBrief) this.el.missionBrief.textContent = brief;
  }

  toast(msg, ms = 4200) {
    if (!this.el.toast) return;
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms);
  }

  prompt(text) {
    if (!this.el.prompt) return;
    if (text) { this.el.prompt.textContent = text; this.el.prompt.style.display = 'block'; }
    else this.el.prompt.style.display = 'none';
  }

  update(g) {
    const p = g.player;
    if (this.el.health) this.el.health.style.width = Math.max(0, p.health) + '%';
    if (this.el.armor) this.el.armor.style.width = Math.max(0, p.armor) + '%';
    if (this.el.cash) this.el.cash.textContent = '$' + Math.floor(p.money).toLocaleString();
    if (this.el.clock) {
      const h = Math.floor(g.hour), m = Math.floor((g.hour - h) * 60);
      this.el.clock.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    if (this.el.weather) this.el.weather.textContent = g.weather.rain ? '☂ Rain' : '☀ Clear';
    if (this.el.stars) {
      const n = Math.round(p.wanted);
      this.el.stars.textContent = '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
      this.el.stars.style.color = n >= 3 ? '#ff2e3c' : '#ffc233';
    }
    if (this.el.weapons) {
      this.el.weapons.innerHTML = WEAPONS.map((w, i) => {
        const sel = i === p.weaponIdx ? 'sel' : '';
        return `<span class="${sel}">${i + 1} ${w.name} · ${p.ammo[i]} / ${p.reserve[i]}</span>`;
      }).join('');
    }
    if (this.el.speed) {
      const v = p.inVehicle ? Math.abs(p.inVehicle.speed) * 3.6 : 0;
      this.el.speed.textContent = p.inVehicle ? `${Math.round(v)} km/h · ${p.inVehicle.v.userData.kind === 'bike' ? 'Motorcycle' : 'Comet Sport'}` : '';
    }
    this.drawMinimap(g);
  }

  drawMinimap(g) {
    if (!this.map) return;
    const c = this.map, S = 150;
    c.clearRect(0, 0, S, S);
    c.fillStyle = '#0d1526'; c.fillRect(0, 0, S, S);
    const toMap = (x, z) => [((x + 170) / 340) * S, ((z + 170) / 340) * S];
    // sea
    c.fillStyle = '#0e3a5e'; c.fillRect(((236 + 170) / 340) * S, 0, S - ((236 + 170) / 340) * S, S);
    // sand
    c.fillStyle = '#d9c08a'; c.fillRect(((168 + 170) / 340) * S, 0, ((236 - 168) / 340) * S, S);
    // roads
    c.strokeStyle = '#3a3f46'; c.lineWidth = 5;
    for (const ax of [-120, -60, 0, 60, 120]) {
      const [x0, y0] = toMap(ax, -170), [x1, y1] = toMap(ax, 170);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    for (const sz of [-120, -60, 0, 60, 120]) {
      const [x0, y0] = toMap(-170, sz), [x1, y1] = toMap(170, sz);
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    }
    // plaza
    const [px, py] = toMap(0, 0);
    c.fillStyle = '#00e5ff'; c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fill();
    // route line to the objective
    if (g.missions && g.missions.marker && g.missions.marker.visible) {
      const t = g.missions.target;
      const [tx, ty] = toMap(t.x, t.z);
      const [ux, uy] = toMap(g.player.pos.x, g.player.pos.z);
      c.strokeStyle = '#ffc233'; c.lineWidth = 2; c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(ux, uy); c.lineTo(tx, ty); c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#ffc233'; c.beginPath(); c.arc(tx, ty, 4, 0, Math.PI * 2); c.fill();
    }
    // traffic dots
    c.fillStyle = '#e8e8e8';
    for (const d of g.traffic.cars) {
      const [x, y] = toMap(d.pos.x, d.pos.z);
      c.fillRect(x - 1, y - 1, 2, 2);
    }
    // police dots
    c.fillStyle = '#2e7dff';
    for (const u of g.police.units) {
      const [x, y] = toMap(u.driver.pos.x, u.driver.pos.z);
      c.beginPath(); c.arc(x, y, 2.5, 0, Math.PI * 2); c.fill();
    }
    // player arrow
    const [ux, uy] = toMap(g.player.pos.x, g.player.pos.z);
    c.save();
    c.translate(ux, uy); c.rotate(Math.atan2(Math.sin(g.player.heading), Math.cos(g.player.heading)) + Math.PI);
    c.fillStyle = '#ff2e88';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(-4, 5); c.closePath(); c.fill();
    c.restore();
  }
}
