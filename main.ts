// Neon Bay — the entry program for the make.fun gta6-01 bounty.
//
// It hands the game in: it copies the playable static game in game/ and the
// four real screenshots in screenshots/ beside this file into the output
// directory, then writes /output/dossier.json with the kit's buildDossier
// library (vendor/makefun-game.ts). Node 22 runs this file as-is; it uses
// only the standard library. Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyGameIntoOutput(): void {
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  const shots = join(repoRoot, 'screenshots');
  if (existsSync(shots)) {
    cpSync(shots, join(outDir, 'screenshots'), { recursive: true });
  }
}

function writeDossier(): void {
  // The scorer's own caps from the kit's reference/gate.json: the text budget
  // shapes the dossier's bytes; the other caps refuse an entry the scorer
  // would refuse (more than 4 screenshots or one over 256 KiB; more than 993
  // files in game/ or 48 MiB of game files in all; a path under game/ over
  // 1000 bytes).
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

copyGameIntoOutput();
writeDossier();
console.log(`Neon Bay handed in: ${outDir}`);
