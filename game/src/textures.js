// Neon Bay — procedural canvas textures. Everything the game shows is drawn
// in code at load time: no image files, no network, and the ground reads as
// a real city instead of flat grey.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// The whole map in one 2048 texture: asphalt streets with lane markings and
// crosswalks, sidewalks with curbs, a tiled central plaza, grass parks,
// a sand beach that grades into the ocean edge.
export function makeGroundTexture(size, cfg) {
  const S = 2048;
  const c = canvas(S, S);
  const g = c.getContext('2d');
  const toPx = (v) => ((v + size / 2) / size) * S;

  // Base: dark asphalt with a subtle blue tint.
  g.fillStyle = '#23282f';
  g.fillRect(0, 0, S, S);

  // Asphalt noise so the road is not a flat colour (stronger contrast).
  for (let i = 0; i < 14000; i++) {
    const x = Math.random() * S, y = Math.random() * S;
    const v = Math.random();
    g.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
    g.fillRect(x, y, 2, 2);
  }
  // A few pale patches: repaired asphalt and wear.
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)';
    const px2 = Math.random() * S, py2 = Math.random() * S;
    g.fillRect(px2, py2, 8 + Math.random() * 20, 5 + Math.random() * 12);
  }

  const block = cfg.blockSize, road = cfg.roadWidth;
  const half = size / 2;

  // Grass parks inside some blocks (green, mottled, with tree dots) —
  // inset from the block edge so they read as parks, not green slabs.
  for (let bx = -3; bx <= 3; bx++) {
    for (let bz = -3; bz <= 3; bz++) {
      if ((bx + bz * 2) % 3 !== 0) continue;
      const cx = bx * block, cz = bz * block;
      if (Math.abs(cx) > half - block || Math.abs(cz) > half - block) continue;
      if (Math.abs(cx) < cfg.plaza.half + block && Math.abs(cz) < cfg.plaza.half + block) continue;
      const inset = road / 2 + 8;
      const x = toPx(cx - block / 2 + inset), y = toPx(cz - block / 2 + inset);
      const w = (block - inset * 2) * (S / size), h = (block - inset * 2) * (S / size);
      g.fillStyle = '#2e5d33';
      g.fillRect(x, y, w, h);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
        g.fillRect(x + Math.random() * w, y + Math.random() * h, 3, 3);
      }
      // Tree dots: darker green circles scattered on the lawn.
      for (let i = 0; i < 7; i++) {
        g.fillStyle = '#1d4023';
        g.beginPath();
        g.arc(x + 8 + Math.random() * (w - 16), y + 8 + Math.random() * (h - 16), 5 + Math.random() * 4, 0, Math.PI * 2);
        g.fill();
      }
      // A pale path cross through the park.
      g.fillStyle = 'rgba(220,205,170,0.55)';
      g.fillRect(x + w / 2 - 3, y, 6, h);
      g.fillRect(x, y + h / 2 - 3, w, 6);
    }
  }

  // Sidewalk borders around each block: light pavement with a curb line.
  g.strokeStyle = '#b0b5bc';
  g.lineWidth = 3;
  for (let bx = -3; bx <= 3; bx++) {
    for (let bz = -3; bz <= 3; bz++) {
      const cx = bx * block, cz = bz * block;
      if (Math.abs(cx) > half - block || Math.abs(cz) > half - block) continue;
      const x = toPx(cx - block / 2 + road / 2), y = toPx(cz - block / 2 + road / 2);
      const w = (block - road) * (S / size), h = (block - road) * (S / size);
      g.fillStyle = '#565b63';
      g.fillRect(x, y, w, h);
      g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
  }

  // Central plaza: warm dark stone tile pattern (never pale sand).
  const px = toPx(-cfg.plaza.half), py = toPx(-cfg.plaza.half);
  const pw = cfg.plaza.half * 2 * (S / size);
  g.fillStyle = '#5d4c3a';
  g.fillRect(px, py, pw, pw);
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 2;
  const tile = pw / 12;
  for (let i = 0; i <= 12; i++) {
    g.beginPath(); g.moveTo(px + i * tile, py); g.lineTo(px + i * tile, py + pw); g.stroke();
    g.beginPath(); g.moveTo(px, py + i * tile); g.lineTo(px + pw, py + i * tile); g.stroke();
  }
  // Alternating tile tint so the plaza reads as laid stone, not one slab.
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      if ((i + j) % 2 === 0) g.fillRect(px + i * tile, py + j * tile, tile, tile);
    }
  }
  // Plaza centre medallion.
  g.fillStyle = '#ff2d78';
  g.beginPath(); g.arc(px + pw / 2, py + pw / 2, tile * 1.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#00c2a8';
  g.beginPath(); g.arc(px + pw / 2, py + pw / 2, tile * 0.7, 0, Math.PI * 2); g.fill();

  // Lane markings: dashed centre lines on every road, in both directions.
  g.fillStyle = '#e8d24a';
  const dashLen = 14, gapLen = 16;
  for (let i = -3; i <= 3; i++) {
    const roadC = i * block;
    // Vertical roads (constant x).
    const vx = toPx(roadC);
    for (let y = 0; y < S; y += dashLen + gapLen) {
      if (Math.abs(((y / S) * size - size / 2)) > half) continue;
      g.fillRect(vx - 2, y, 4, dashLen);
    }
    // Horizontal roads (constant z).
    const hz = toPx(roadC);
    for (let x = 0; x < S; x += dashLen + gapLen) {
      g.fillRect(x, hz - 2, dashLen, 4);
    }
  }

  // Tyre tracks: twin dark wheel lines down each road, so the asphalt
  // reads as driven-on, not painted. (Skipped across the central plaza.)
  g.fillStyle = 'rgba(0,0,0,0.16)';
  const plazaTop = toPx(-48), plazaBottom = toPx(48);
  for (let i = -3; i <= 3; i++) {
    const roadC = i * block;
    for (const off of [-3.2, 3.2]) {
      const vx = toPx(roadC + off);
      if (Math.abs(roadC) > 48) {
        g.fillRect(vx - 2, 0, 4, S);
      } else {
        g.fillRect(vx - 2, 0, 4, plazaTop);
        g.fillRect(vx - 2, plazaBottom, 4, S - plazaBottom);
      }
      const hz = toPx(roadC + off);
      if (Math.abs(roadC) > 48) {
        g.fillRect(0, hz - 2, S, 4);
      } else {
        g.fillRect(0, hz - 2, plazaTop, 4);
        g.fillRect(plazaBottom, hz - 2, S - plazaBottom, 4);
      }
    }
  }

  // Solid white edge lines along every road (also skipped at the plaza).
  g.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = -3; i <= 3; i++) {
    const roadC = i * block;
    for (const off of [-5, 5]) {
      const vx = toPx(roadC + off);
      if (Math.abs(roadC) > 48) {
        g.fillRect(vx - 1, 0, 2, S);
      } else {
        g.fillRect(vx - 1, 0, 2, plazaTop);
        g.fillRect(vx - 1, plazaBottom, 2, S - plazaBottom);
      }
      const hz = toPx(roadC + off);
      if (Math.abs(roadC) > 48) {
        g.fillRect(0, hz - 1, S, 2);
      } else {
        g.fillRect(0, hz - 1, plazaTop, 2);
        g.fillRect(plazaBottom, hz - 1, S - plazaBottom, 2);
      }
    }
  }

  // Crosswalks: zebra stripes where roads meet the plaza ring.
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [cx, cz] of [[0, -52], [0, 52], [-52, 0], [52, 0]]) {
    const x = toPx(cx), y = toPx(cz);
    for (let k = -4; k <= 4; k++) {
      g.fillRect(x + k * 6 - 2, y - 8, 4, 16);
    }
  }

  // Beach: warm sand grading from pale to deep gold, east edge.
  const beachStart = toPx(cfg.beachX - 30);
  const grad = g.createLinearGradient(beachStart, 0, S, 0);
  grad.addColorStop(0, '#d9b380');
  grad.addColorStop(0.5, '#e8c99a');
  grad.addColorStop(1, '#f2dcae');
  g.fillStyle = grad;
  g.fillRect(beachStart, 0, S - beachStart, S);
  // Sand speckle.
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(120,80,40,0.10)' : 'rgba(255,255,255,0.10)';
    g.fillRect(beachStart + Math.random() * (S - beachStart), Math.random() * S, 2, 2);
  }
  // Wet sand band at the water line.
  g.fillStyle = 'rgba(120,90,50,0.35)';
  g.fillRect(toPx(cfg.oceanX - 6), 0, toPx(6) - toPx(0) + 12, S);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Soft radial glow sprite (for neon signs, lamps, headlights).
export function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace(',1)', ',0.45)'));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Text sign texture: glowing letters on a dark plate (neon signage).
export function makeSignTexture(text, color = '#ff2d78', sub = '') {
  const c = canvas(512, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12';
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.strokeRect(6, 6, 500, 116);
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 22;
  g.fillStyle = color;
  g.fillText(text, 256, sub ? 52 : 64);
  if (sub) {
    g.font = 'bold 28px Arial, sans-serif';
    g.shadowBlur = 10;
    g.fillText(sub, 256, 100);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Ocean surface: deep blue with painted wave streaks (offset animated).
export function makeOceanTexture() {
  const c = canvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#0b3d66';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(120,200,255,0.25)';
  g.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * 512;
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      g.lineTo(x, y + Math.sin(x * 0.05 + i) * 6);
    }
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 300; i++) {
    g.fillRect(Math.random() * 512, Math.random() * 512, 3, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
