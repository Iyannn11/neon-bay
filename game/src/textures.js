// Neon Bay — procedural canvas textures. Every facade, road and ground surface
// gets its detail baked into a texture (window strips, balconies, lane paint,
// sand speckle, water streaks) so the city reads as dense and finished from
// any angle without thousands of extra meshes. Written fresh for Round 12.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function speckle(ctx, w, h, n, colors, alpha, size = 2) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = Math.random() * alpha;
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
  ctx.globalAlpha = 1;
}

// --- ground -----------------------------------------------------------------
export function asphaltTexture() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#23262b'; x.fillRect(0, 0, 512, 512);
  speckle(x, 512, 512, 9000, ['#2e3238', '#1b1e22', '#3a3f46'], 0.5, 2);
  // tyre wear: two darker bands per lane
  x.fillStyle = 'rgba(12,13,16,0.35)';
  x.fillRect(90, 0, 46, 512); x.fillRect(376, 0, 46, 512);
  x.fillRect(0, 90, 512, 46); x.fillRect(0, 376, 512, 46);
  // patched cracks
  x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    x.beginPath();
    let px = Math.random() * 512, py = Math.random() * 512;
    x.moveTo(px, py);
    for (let j = 0; j < 4; j++) { px += (Math.random() - 0.5) * 90; py += (Math.random() - 0.5) * 90; x.lineTo(px, py); }
    x.stroke();
  }
  // centre dashes (vertical, so the texture tiles along the road)
  x.fillStyle = '#e8e4c8';
  for (let y = 0; y < 512; y += 64) x.fillRect(252, y + 8, 8, 34);
  // solid edge lines
  x.fillStyle = '#f2f2f2';
  x.fillRect(14, 0, 5, 512); x.fillRect(493, 0, 5, 512);
  return tex(c);
}

export function sidewalkTexture() {
  const [c, x] = canvas(256, 256);
  x.fillStyle = '#8d9299'; x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 2600, ['#7c8188', '#9aa0a7', '#6e737a'], 0.5, 2);
  x.strokeStyle = 'rgba(40,42,46,0.55)'; x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke();
    x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke();
  }
  return tex(c);
}

export function plazaTexture() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#6f7480'; x.fillRect(0, 0, 512, 512);
  speckle(x, 512, 512, 5000, ['#5d626b', '#82878f', '#4c5158'], 0.45, 2);
  // big tiles
  x.strokeStyle = 'rgba(30,32,38,0.6)'; x.lineWidth = 4;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i * 128); x.lineTo(512, i * 128); x.stroke();
  }
  // neon accent inlay lines
  x.strokeStyle = 'rgba(0,229,255,0.75)'; x.lineWidth = 5;
  x.strokeRect(64, 64, 384, 384);
  x.strokeStyle = 'rgba(255,46,136,0.75)';
  x.strokeRect(128, 128, 256, 256);
  return tex(c);
}

export function sandTexture() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#d9c08a'; x.fillRect(0, 0, 512, 512);
  speckle(x, 512, 512, 11000, ['#c9ae72', '#e6d199', '#b89f66', '#f0e0b0'], 0.55, 2);
  // wind ripples
  x.strokeStyle = 'rgba(140,115,70,0.35)'; x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 512;
    x.beginPath(); x.moveTo(0, y);
    for (let px = 0; px <= 512; px += 32) x.lineTo(px, y + Math.sin(px * 0.05 + i) * 5);
    x.stroke();
  }
  return tex(c);
}

export function waterTexture() {
  const [c, x] = canvas(512, 512);
  const g = x.createLinearGradient(0, 0, 512, 512);
  g.addColorStop(0, '#2e86b8'); g.addColorStop(0.5, '#1e6a9a'); g.addColorStop(1, '#2e86b8');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  // wave streaks
  x.strokeStyle = 'rgba(180,225,255,0.55)'; x.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * 512, len = 30 + Math.random() * 90, px = Math.random() * 512;
    x.beginPath(); x.moveTo(px, y); x.lineTo(px + len, y + (Math.random() - 0.5) * 8); x.stroke();
  }
  x.strokeStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 24; i++) {
    const y = Math.random() * 512, len = 14 + Math.random() * 40, px = Math.random() * 512;
    x.beginPath(); x.moveTo(px, y); x.lineTo(px + len, y); x.stroke();
  }
  return tex(c);
}

// --- facades ----------------------------------------------------------------
// Each facade is a tall texture: floors of window STRIPS (never square grids),
// balconies, floor cornices and colour variation. `variant` picks the palette.
export function facadeTexture(variant) {
  const palettes = [
    { base: '#c65a7a', trim: '#e88aa8', glow: '#ffd166', dark: '#5c2438' }, // pink loft
    { base: '#c96f2e', trim: '#e8a05a', glow: '#ffe9a8', dark: '#5e3010' }, // orange block
    { base: '#2e6f8e', trim: '#5aa8c9', glow: '#bfeaff', dark: '#0f2f40' }, // teal glass
    { base: '#3a3f4a', trim: '#6a7180', glow: '#9fe8ff', dark: '#14161c' }, // dark tower
    { base: '#d8c49a', trim: '#f0e0b8', glow: '#fff3c4', dark: '#6e5c34' }, // cream hotel
    { base: '#7a3fa0', trim: '#b07ad6', glow: '#ff9df5', dark: '#33124a' }, // violet
  ];
  const p = palettes[variant % palettes.length];
  const W = 256, H = 512;
  const [c, x] = canvas(W, H);
  x.fillStyle = p.base; x.fillRect(0, 0, W, H);
  // subtle vertical shading
  const vg = x.createLinearGradient(0, 0, W, 0);
  vg.addColorStop(0, 'rgba(0,0,0,0.28)'); vg.addColorStop(0.5, 'rgba(255,255,255,0.06)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
  x.fillStyle = vg; x.fillRect(0, 0, W, H);
  const floors = 10;
  const fh = H / floors;
  for (let f = 0; f < floors; f++) {
    const y = f * fh;
    // floor cornice
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, y, W, 4);
    x.fillStyle = p.trim; x.fillRect(0, y + 4, W, 2);
    // window strip: one long glowing band per floor, broken into panes
    const lit = Math.random() < 0.72;
    x.fillStyle = lit ? p.glow : p.dark;
    x.fillRect(14, y + 12, W - 28, 16);
    x.fillStyle = 'rgba(0,0,0,0.5)';
    for (let px = 26; px < W - 20; px += 18) x.fillRect(px, y + 12, 3, 16);
    // balcony rail on some floors
    if (f % 2 === 0) {
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(10, y + fh - 12, W - 20, 8);
      x.fillStyle = p.trim; x.fillRect(10, y + fh - 14, W - 20, 2);
    }
    // AC unit / vent details
    if (Math.random() < 0.4) {
      x.fillStyle = 'rgba(20,20,24,0.7)';
      x.fillRect(20 + Math.random() * 180, y + fh - 26, 18, 10);
    }
  }
  // ground-floor shopfront band
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(0, H - 56, W, 56);
  x.fillStyle = p.glow; x.fillRect(0, H - 58, W, 3);
  return tex(c);
}

export function glassTexture() {
  const [c, x] = canvas(256, 512);
  const g = x.createLinearGradient(0, 0, 256, 512);
  g.addColorStop(0, '#1d3a4d'); g.addColorStop(0.5, '#0f2233'); g.addColorStop(1, '#1d3a4d');
  x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  // glass mullions
  x.strokeStyle = 'rgba(180,220,255,0.35)'; x.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 512); x.stroke(); }
  for (let i = 0; i <= 16; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(256, i * 32); x.stroke(); }
  // lit panes scattered
  for (let i = 0; i < 46; i++) {
    x.fillStyle = Math.random() < 0.6 ? 'rgba(255,220,130,0.85)' : 'rgba(160,220,255,0.8)';
    x.fillRect((Math.random() * 7 | 0) * 32 + 4, (Math.random() * 15 | 0) * 32 + 4, 24, 24);
  }
  // diagonal sun reflection
  x.fillStyle = 'rgba(255,255,255,0.10)';
  x.beginPath(); x.moveTo(0, 512); x.lineTo(256, 0); x.lineTo(256, 160); x.lineTo(0, 512); x.fill();
  return tex(c);
}

// --- signs & sprites ----------------------------------------------------------
export function neonSignTexture(text, color = '#ff2e88', sub = '') {
  const [c, x] = canvas(512, 128);
  x.fillStyle = '#0c0d12'; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = color; x.lineWidth = 6; x.strokeRect(6, 6, 500, 116);
  x.shadowColor = color; x.shadowBlur = 22;
  x.fillStyle = color;
  x.font = 'bold 54px Arial, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 256, sub ? 48 : 64);
  if (sub) {
    x.font = 'bold 28px Arial, sans-serif';
    x.shadowBlur = 12;
    x.fillText(sub, 256, 96);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function billboardTexture() {
  const [c, x] = canvas(512, 256);
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#ff7a3d'); g.addColorStop(0.55, '#e84a7a'); g.addColorStop(1, '#3d1a5e');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  // palm silhouettes
  x.fillStyle = 'rgba(20,8,30,0.85)';
  for (const [px, s] of [[80, 1], [430, 1.2], [250, 0.8]]) {
    x.save(); x.translate(px, 256); x.scale(s, s);
    x.fillRect(-4, -120, 8, 120);
    for (let i = 0; i < 6; i++) {
      x.save(); x.rotate(-0.5 - i * 0.35);
      x.beginPath(); x.ellipse(-38, -118, 42, 9, 0, 0, Math.PI * 2); x.fill();
      x.restore();
    }
    x.restore();
  }
  x.fillStyle = '#fff'; x.font = 'bold 58px Arial, sans-serif'; x.textAlign = 'center';
  x.fillText('NEON BAY', 256, 96);
  x.font = 'bold 26px Arial, sans-serif'; x.fillStyle = '#ffe9a8';
  x.fillText('VICE CITY OF THE SOUTH', 256, 140);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function glowTexture(color = '#ffffff') {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, color); g.addColorStop(0.35, color + 'aa'); g.addColorStop(1, color + '00');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function cloudTexture() {
  const [c, x] = canvas(256, 128);
  for (let i = 0; i < 14; i++) {
    const px = 40 + Math.random() * 176, py = 44 + Math.random() * 44, r = 22 + Math.random() * 30;
    const g = x.createRadialGradient(px, py, 2, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
