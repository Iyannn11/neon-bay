// hud.js — the heads-up display: health, cash, wanted stars, speed, clock,
// the mission panel, banners and toasts, and the 2D minimap. The minimap is
// a small canvas drawn top-down: streets, the player arrow, traffic dots,
// police dots and the mission marker.

export class HUD {
  constructor() {
    this.el = {};
    const ids = ['healthFill', 'healthText', 'cashText', 'stars', 'speedText', 'clockText', 'missionName', 'missionStep', 'missionReward', 'banner', 'toast', 'minimap', 'objectiveArrow', 'wantedLabel', 'ammoText'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.bannerTimer = 0;
    this.toastTimer = 0;
    this.minimapCtx = this.el.minimap ? this.el.minimap.getContext('2d') : null;
  }

  setHealth(hp) {
    const pct = Math.max(0, Math.min(100, hp));
    if (this.el.healthFill) this.el.healthFill.style.width = pct + '%';
    if (this.el.healthText) this.el.healthText.textContent = Math.ceil(pct);
    if (this.el.healthFill) {
      this.el.healthFill.style.background = pct > 50 ? '#39d353' : pct > 25 ? '#ffb020' : '#ff3b30';
    }
  }

  setCash(cash) {
    if (this.el.cashText) this.el.cashText.textContent = '$' + Math.floor(cash).toLocaleString('en-US');
  }

  setWanted(level) {
    const stars = Math.round(level);
    if (this.el.stars) {
      this.el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
      this.el.stars.classList.toggle('hot', stars >= 3);
    }
    if (this.el.wantedLabel) {
      this.el.wantedLabel.textContent = stars === 0 ? 'CLEAN' : stars <= 2 ? 'WANTED' : stars <= 3 ? 'HEAT' : 'MOST WANTED';
    }
  }

  setSpeed(kmh) {
    if (this.el.speedText) this.el.speedText.textContent = Math.round(Math.abs(kmh)) + ' km/h';
  }

  setClock(minutes) {
    if (!this.el.clockText) return;
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.floor(minutes % 60);
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    this.el.clockText.textContent = hh + ':' + mm;
  }

  setAmmo(ammo, mag, reloading) {
    if (!this.el.ammoText) return;
    this.el.ammoText.textContent = reloading ? 'RELOADING…' : 'AMMO ' + ammo + '/' + mag;
  }

  setMission(mission, step) {
    if (this.el.missionName) this.el.missionName.textContent = mission ? mission.name : '—';
    if (this.el.missionStep) this.el.missionStep.textContent = step ? step.label : 'All missions complete — Neon Bay is yours.';
    if (this.el.missionReward) this.el.missionReward.textContent = mission ? 'Reward $' + mission.reward.toLocaleString('en-US') : '';
  }

  banner(text, sub) {
    if (!this.el.banner) return;
    this.el.banner.innerHTML = '<div class="banner-title">' + text + '</div>' + (sub ? '<div class="banner-sub">' + sub + '</div>' : '');
    this.el.banner.classList.add('show');
    this.bannerTimer = 2.6;
  }

  toast(text) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add('show');
    this.toastTimer = 2.2;
  }

  // The objective arrow: rotates to point at the target from the player.
  setObjectiveArrow(angleDeg, visible) {
    if (!this.el.objectiveArrow) return;
    this.el.objectiveArrow.style.display = visible ? 'block' : 'none';
    if (visible) this.el.objectiveArrow.style.transform = 'rotate(' + angleDeg + 'deg)';
  }

  // Minimap: 170x170 canvas, world -190..190 mapped to the square.
  drawMinimap(player, traffic, police, target, night) {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const S = 170;
    const map = (v) => ((v + 190) / 380) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = night ? '#0d1428' : '#1d2a3a';
    ctx.fillRect(0, 0, S, S);
    // Streets.
    ctx.strokeStyle = night ? '#2a2d34' : '#3a3f47';
    ctx.lineWidth = 5;
    for (let v = -160; v <= 160; v += 40) {
      ctx.beginPath(); ctx.moveTo(map(v), 0); ctx.lineTo(map(v), S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, map(v)); ctx.lineTo(S, map(v)); ctx.stroke();
    }
    // Sea along the bottom edge.
    ctx.fillStyle = '#1a5f8a';
    ctx.fillRect(0, map(-190) - 8, S, 12);
    // Mission target.
    if (target) {
      ctx.fillStyle = '#ffc233';
      ctx.beginPath();
      ctx.arc(map(target[0]), map(target[1]), 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#9aa2ac';
    for (const car of traffic.cars) {
      ctx.fillRect(map(car.x) - 1.5, map(car.z) - 1.5, 3, 3);
    }
    // Police dots (blue, flashing).
    const flash = Math.floor(performance.now() / 300) % 2 === 0;
    ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
    for (const car of police.cars) {
      ctx.beginPath();
      ctx.arc(map(car.x), map(car.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(map(player.x), map(player.z));
    ctx.rotate(player.heading || 0);
    ctx.fillStyle = '#39ff88';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0 && this.el.banner) this.el.banner.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0 && this.el.toast) this.el.toast.classList.remove('show');
    }
  }
}
