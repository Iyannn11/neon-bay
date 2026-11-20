# Neon Bay — Open World

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Bay** is a complete open-world crime game for the make.fun "Make GTA 6"
bounty: explore a sun-soaked coastal city on foot and by car, steal cars,
outrun the Bay PD, fight, and run six story missions as Kai Reyes — from a
marina pickup to the Coral Bank heist, a yacht escape, and a final run to
bring the heist cash home.

## Play

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step, no network: everything the game loads lives under `game/`.

## Controls

- **WASD** — walk / drive (Shift to run, Space for handbrake)
- **E** — enter a car, pick up a package, interact
- **F** — punch · **2** — pistol, **click** — shoot, **R** — reload
- **Enter** — start the next job · **Esc** — pause · **M** — mute
- **Drag mouse** — orbit the camera

## Features

- Procedural coastal city: downtown towers, suburbs, beach, boardwalk, ocean,
  palms, neon signs, traffic lights
- Traffic AI (lane driving, red lights, queues) and pedestrians who stroll
  the sidewalks and flee from gunfire and speeding cars
- Any car can be stolen (E) — stealing, hitting pedestrians and shooting
  raise the wanted level (0–5 stars); police cars chase, ram and try to bust
  you; heat decays once you are out of sight
- Six chained story missions with a glowing objective beacon, HUD tracker,
  minimap blips and an off-screen objective arrow
- Combat (fists + pistol), police return fire, health, cash and respect
  progression, localStorage saves, start / pause / game-over screens
- HUD with health, cash, wanted stars, speed, clock, mission panel and a
  live 2D minimap; all sound is synthesised with WebAudio (engine, sirens,
  gunshots, music) — no audio files
- Deterministic screenshot scenes: `?shot=start|chase|mission|night`

## Layout

- `main.ts` — hands `game/` + `screenshots/` to `/output` with a dossier
- `game/index.html` — the game page (import map: `three` → vendored three.js)
- `game/src/` — one job per file: `main.js` (boot/loop), `city.js`,
  `vehicles.js`, `pedestrians.js`, `police.js`, `missions.js`, `combat.js`,
  `hud.js`, `audio.js`, `save.js`, `input.js`, `config.js`, `random.js`,
  `shots.js`
- `game/vendor/three.module.min.js` — three.js r160 (MIT), vendored
- `screenshots/` — four real renders of the game

## License

MIT — see `LICENSE`. Everything in Neon Bay (city, characters, vehicles,
names, story, art, sounds, music) is original.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
