// main.ts — Neon Bay's hand-in program (Node 22, standard library only).
// It gathers the game and its screenshots from beside this file, drops them
// into the output folder, and writes the dossier the judge reads, using the
// kit's own buildDossier. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps below are the scorer's own (reference/gate.json): the text cap
// shapes the dossier's bytes; the rest refuse an entry the scorer would
// refuse anyway, so a bad build fails here first, loudly, instead of at
// grading time.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the repository lives and where the hand-in goes.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// The scorer's caps, in the same units it uses.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function countGameFiles(dir, base = dir) {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      const sub = countGameFiles(full, base);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += st.size;
      const rel = full.slice(base.length);
      if (Buffer.byteLength(rel, 'utf8') > CAPS.game_path_max_bytes) {
        throw new Error('game path too long: ' + rel);
      }
    }
  }
  return { files, bytes };
}

function checkShots() {
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing');
  const names = readdirSync(shotsDir).filter((n) => !n.startsWith('.'));
  if (names.length < 3 || names.length > CAPS.screenshots.max) {
    throw new Error('expected 3 or 4 screenshots, found ' + names.length);
  }
  for (const name of names) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > CAPS.screenshots.max_bytes) {
      throw new Error('screenshot over 256 KiB: ' + name + ' (' + size + ' bytes)');
    }
  }
  return names;
}

// Fail fast on anything the gate would refuse.
const gameTotals = countGameFiles(gameDir);
if (gameTotals.files > CAPS.game_max_files) {
  throw new Error('game/ has ' + gameTotals.files + ' files, cap is ' + CAPS.game_max_files);
}
if (gameTotals.bytes > CAPS.game_max_bytes) {
  throw new Error('game/ is ' + gameTotals.bytes + ' bytes, cap is ' + CAPS.game_max_bytes);
}
const shotNames = checkShots();

// Copy the entry into the output folder, then write the dossier from it.
mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(
  'Neon Bay handed in: ' + gameTotals.files + ' game files (' + gameTotals.bytes + ' bytes), '
  + shotNames.length + ' screenshots, dossier ' + Buffer.byteLength(dossier, 'utf8') + ' bytes -> ' + outDir,
);
