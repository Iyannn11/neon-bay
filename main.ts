// Neon Bay — entry program (Node 22, standard library only).
// Hands the game in: copies this repo's game/ and screenshots/ into the
// grader's output directory and writes dossier.json there with the kit's
// vendored buildDossier library. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output, e.g. `MAKEFUN_OUTPUT_DIR=out node main.ts`.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function handIn() {
  mkdirSync(outDir, { recursive: true });
  const gameSrc = join(repoRoot, 'game');
  const gameDst = join(outDir, 'game');
  cpSync(gameSrc, gameDst, { recursive: true });

  const shotsSrc = join(repoRoot, 'screenshots');
  const shotsDst = join(outDir, 'screenshots');
  mkdirSync(shotsDst, { recursive: true });
  if (existsSync(shotsSrc)) {
    cpSync(shotsSrc, shotsDst, { recursive: true });
  }

  const shotNames = existsSync(shotsDst) ? readdirSync(shotsDst).sort() : [];
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Neon Bay handed in: ${shotNames.length} screenshot(s), dossier ${dossier.length} bytes -> ${outDir}`);
}

handIn();
