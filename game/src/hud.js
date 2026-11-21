// Neon Bay — the HUD and the minimap.
//
// One clear job: everything the player reads while playing — health, armor,
// money, wanted stars, the clock, the mission panel, speed, weapon, and a
// live 2D minimap drawn on a canvas (roads, the player, the mission marker,
// police, and the taxi).

import { WORLD } from './config.js';
import { clamp } from './random.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.minimap = $('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.toastTimer = null;
    this.msgTimer = null;
  }

  show() { $('hud').classList.remove('hidden'); }
  hide() { $('hud').classList.add('hidden'); }

  setMoney(n) {
    $('money').textContent = `$${n.toLocaleString('en-US')}`;
  }

  setClock(hour, day) {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour % 1) * 60);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    const part = hour >= 6 && hour < 18 ? 'DAY' : hour >= 17.5 && hour < 19.5 ? 'SUNSET' : 'NIGHT';
    $('clock').textContent = `${hh}:${mm} · ${part} ${day}`;
  }

  setWanted(stars) {
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += i < stars ? '★' : '<span class="dim">★</span>';
    }
    $('wanted').innerHTML = html;
  }

  setHealth(health, armor) {
    $('health-fill').style.width = `${clamp(health, 0, 100)}%`;
    $('armor-fill').style.width = `${clamp(armor, 0, 100)}%`;
  }

  setMission(title, objective, timer) {
    $('mission-title').textContent = title;
    $('mission-objective').textContent = objective;
    const t = $('mission-timer');
    if (timer !== null && timer !== undefined) {
      t.classList.remove('hidden');
      const s = Math.max(0, Math.ceil(timer));
      t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      t.style.color = s < 30 ? '#ff2e63' : '#ffd23e';
    } else {
      t.classList.add('hidden');
    }
  }

  setSpeed(kmh, vehicleName) {
    $('speed').textContent = String(Math.round(kmh));
    $('vehicle-name').textContent = vehicleName;
  }

  setWeapon(name, ammo, slots) {
    $('weapon').textContent = name;
    $('ammo').textContent = ammo;
    $('weapon-slots').innerHTML = slots;
  }

  toast(text, ms = 2600) {
    const el = $('toast');
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { el.style.opacity = '0'; }, ms);
  }

  center(text, sub = '') {
    const el = $('center-message');
    const subEl = $('center-sub');
    el.textContent = text;
    subEl.textContent = sub;
    el.style.opacity = '1';
    subEl.style.opacity = sub ? '1' : '0';
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => {
      el.style.opacity = '0';
      subEl.style.opacity = '0';
    }, 2200);
  }

  setFps(fps) {
    $('fps').textContent = `${fps} FPS`;
  }

  // The minimap: a top-down canvas. North is up; the player is the centre
  // arrow, the mission marker is cyan, police are red dots, the taxi is gold.
  drawMinimap(playerX, playerZ, heading, marker, policeCars, taxiDrop, crates) {
    const g = this.mapCtx;
    const S = 190;
    const half = WORLD.size / 2;
    const toMap = (v) => ((v + half) / WORLD.size) * S;
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(8,12,28,0.9)';
    g.fillRect(0, 0, S, S);
    // Water + sand on the west edge.
    g.fillStyle = '#0a4a6e';
    g.fillRect(0, 0, toMap(-288), S);
    g.fillStyle = '#8a6a45';
    g.fillRect(toMap(-288), 0, toMap(-256) - toMap(-288), S);
    // Roads.
    g.strokeStyle = 'rgba(160,170,200,0.85)';
    g.lineWidth = 4;
    for (const r of [-288, -224, -160, -96, -32, 32, 96, 160, 224, 288]) {
      g.beginPath(); g.moveTo(toMap(r), 0); g.lineTo(toMap(r), S); g.stroke();
      g.beginPath(); g.moveTo(0, toMap(r)); g.lineTo(S, toMap(r)); g.stroke();
    }
    // Blocks.
    g.fillStyle = 'rgba(70,78,110,0.5)';
    for (let bx = -4; bx <= 4; bx += 1) {
      for (let bz = -4; bz <= 4; bz += 1) {
        g.fillRect(toMap(bx * 64 - 25), toMap(bz * 64 - 25), toMap(50), toMap(50));
      }
    }
    // Crates.
    g.fillStyle = '#ff2e63';
    for (const c of crates) {
      if (!c.found) g.fillRect(toMap(c.mesh.position.x) - 2, toMap(c.mesh.position.z) - 2, 4, 4);
    }
    // Taxi drop-off.
    if (taxiDrop) {
      g.fillStyle = '#ffd23e';
      g.beginPath();
      g.arc(toMap(taxiDrop.x), toMap(taxiDrop.z), 5, 0, Math.PI * 2);
      g.fill();
    }
    // Mission marker, pulsing.
    if (marker) {
      const pulse = 5 + Math.sin(performance.now() * 0.006) * 2;
      g.fillStyle = '#00c2ff';
      g.beginPath();
      g.arc(toMap(marker.x), toMap(marker.z), pulse, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(0,194,255,0.6)';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(toMap(marker.x), toMap(marker.z), pulse + 5, 0, Math.PI * 2);
      g.stroke();
    }
    // Police.
    g.fillStyle = '#ff2030';
    for (const car of policeCars) {
      g.beginPath();
      g.arc(toMap(car.x), toMap(car.z), 3.5, 0, Math.PI * 2);
      g.fill();
    }
    // Player arrow.
    const px = toMap(playerX);
    const pz = toMap(playerZ);
    g.save();
    g.translate(px, pz);
    g.rotate(Math.PI - heading);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#00c2ff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(5.5, 6);
    g.lineTo(0, 3);
    g.lineTo(-5.5, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    // North tick.
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = 'bold 11px system-ui, sans-serif';
    g.fillText('N', S - 14, 14);
  }
}
