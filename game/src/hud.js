// Neon Bay HUD: health, cash, wanted stars, speed, clock, mission panel,
// a 2D minimap (player, traffic, police, objective) and banners / toasts.

export function createHud(doc) {
  const el = (id) => doc.getElementById(id);
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const cashText = el('cash-text');
  const starsEl = el('stars');
  const speedText = el('speed-text');
  const clockText = el('clock-text');
  const missionName = el('mission-name');
  const missionText = el('mission-text');
  const ammoText = el('ammo-text');
  const bannerEl = el('banner');
  const bannerTitle = el('banner-title');
  const bannerSub = el('banner-sub');
  const toastEl = el('toast');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  const arrowEl = el('objective-arrow');
  const arrowGlyph = el('arrow-glyph');
  const arrowDist = el('arrow-dist');
  let bannerTimer = 0;
  let toastTimer = 0;
  let flashTimer = 0;

  function setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    starsEl.textContent = s;
    starsEl.classList.toggle('hot', n >= 3);
  }

  return {
    banner(title, sub) {
      bannerTitle.textContent = title;
      bannerSub.textContent = sub || '';
      bannerEl.classList.add('show');
      bannerTimer = 3.2;
    },
    // Hide the banner at once (shot staging: a frozen banner would cover
    // the centre of the screenshot forever).
    hideBanner() {
      bannerEl.classList.remove('show');
      bannerTimer = 0;
    },
    flash(text) {
      toastEl.textContent = text;
      toastEl.classList.add('show');
      toastTimer = 2.2;
    },
    setMission(name, text) {
      missionName.textContent = name;
      missionText.textContent = text;
    },
    update(dt, game) {
      const p = game.player;
      const health = Math.max(0, Math.round(p.health));
      healthFill.style.width = `${health}%`;
      healthFill.classList.toggle('low', health < 30);
      healthText.textContent = `${health}`;
      cashText.textContent = `$${game.cash.toLocaleString()}`;
      setStars(game.wanted);
      const speed = p.inCar ? Math.abs(Math.round((p.carSpeed || 0) * 3.6)) : Math.round((p.walkSpeed || 0) * 3.6);
      speedText.textContent = `${speed} km/h`;
      const hours = 18 + Math.floor(game.time / 120) % 12;
      const mins = Math.floor((game.time % 120) / 2);
      clockText.textContent = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      ammoText.textContent = game.combat ? `Pistol ${game.combat.ammo}/12${game.combat.reloading ? ' …' : ''}` : '';
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) bannerEl.classList.remove('show');
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) toastEl.classList.remove('show');
      }
      if (flashTimer > 0) {
        flashTimer -= dt;
      }
      this.drawMinimap(game);
      this.updateArrow(game);
    },
    drawMinimap(game) {
      const W = minimap.width;
      const H = minimap.height;
      const half = 200;
      const sx = (x) => ((x + half) / (half * 2)) * W;
      const sz = (z) => ((z + half) / (half * 2)) * H;
      mapCtx.fillStyle = 'rgba(10,14,24,0.85)';
      mapCtx.fillRect(0, 0, W, H);
      // Streets.
      mapCtx.strokeStyle = 'rgba(160,165,180,0.5)';
      mapCtx.lineWidth = 1;
      for (let s = -200; s <= 200; s += 40) {
        mapCtx.beginPath();
        mapCtx.moveTo(sx(s), 0);
        mapCtx.lineTo(sx(s), H);
        mapCtx.stroke();
        mapCtx.beginPath();
        mapCtx.moveTo(0, sz(s));
        mapCtx.lineTo(W, sz(s));
        mapCtx.stroke();
      }
      // Water.
      mapCtx.fillStyle = 'rgba(20,90,130,0.7)';
      mapCtx.fillRect(0, sz(192), W, H - sz(192));
      // Objective.
      const obj = game.missions.objectivePos();
      if (obj) {
        const pulse = 3 + Math.sin(game.time * 5) * 1.5;
        mapCtx.fillStyle = '#ffd23f';
        mapCtx.beginPath();
        mapCtx.arc(sx(obj.x), sz(obj.z), pulse + 2, 0, Math.PI * 2);
        mapCtx.fill();
      }
      // Traffic (grey dots), police (red), player (yellow triangle).
      mapCtx.fillStyle = '#9aa0ad';
      for (const car of game.vehicles.traffic) {
        mapCtx.fillRect(sx(car.x) - 1, sz(car.z) - 1, 2, 2);
      }
      mapCtx.fillStyle = '#ff4444';
      for (const car of game.police.cars) {
        mapCtx.beginPath();
        mapCtx.arc(sx(car.x), sz(car.z), 2.5, 0, Math.PI * 2);
        mapCtx.fill();
      }
      const p = game.player;
      const px = sx(p.pos.x);
      const py = sz(p.pos.z);
      mapCtx.save();
      mapCtx.translate(px, py);
      mapCtx.rotate(p.heading);
      mapCtx.fillStyle = '#ffd23f';
      mapCtx.beginPath();
      mapCtx.moveTo(6, 0);
      mapCtx.lineTo(-4, -4);
      mapCtx.lineTo(-4, 4);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
      // North marker.
      mapCtx.fillStyle = '#cfd4de';
      mapCtx.font = 'bold 10px Arial';
      mapCtx.fillText('N', W - 12, 12);
    },
    updateArrow(game) {
      const obj = game.missions.objectivePos();
      if (!obj) {
        arrowEl.style.opacity = '0';
        return;
      }
      const p = game.player;
      const dx = obj.x - p.pos.x;
      const dz = obj.z - p.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6) {
        arrowEl.style.opacity = '0';
        return;
      }
      // Screen-space angle: world heading vs camera heading. The glyph
      // rotates to point at the objective; the distance stays upright.
      const worldAngle = Math.atan2(dz, dx);
      const camAngle = game.cameraHeading || 0;
      const rel = worldAngle - camAngle;
      arrowEl.style.opacity = '1';
      arrowGlyph.style.display = 'inline-block';
      arrowGlyph.style.transform = `rotate(${(-rel * 180) / Math.PI}deg)`;
      arrowDist.textContent = `${Math.round(dist)}m`;
    },
  };
}
