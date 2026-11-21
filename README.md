[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay — an open-world crime game

An original coastal open-world game in the spirit of GTA 6, built with Three.js.
You are **Kai Reyes**, a driver fresh out of the Neon Bay docks, climbing from
small pickups to the biggest heist the city has ever seen. Drive, steal cars,
outrun the police, and take the crown: **King of the Bay**.

Play it in the browser: serve `game/` with any static server
(`node serve.ts`, then open http://localhost:8080) and drive with the keyboard.

## What is in the game

- **A living city**: Neon Bay — a neon-drenched coastal city with a downtown
  skyline, a beachfront boulevard, a marina, and back streets. Traffic that
  changes lanes, brakes at lights, and dodges you. Pedestrians on the sidewalks.
- **6 story missions + side work**: a full chain from your first pickup to the
  $10,000 finale "King of the Bay", plus taxi fares and hidden neon crates to
  collect around the city.
- **Drive anything**: steal any car on the street (E), each with its own speed
  and handling. Cars are smooth, curved, and polished — no blocky boxes.
- **Wanted 0–5 stars**: the Neon Bay police chase, ram, and roadblock you.
  At 3 stars and up a police helicopter joins the hunt with a searchlight.
- **Combat**: pistol, SMG, and shotgun with ammo, pickups, and muzzle flash.
- **A full HUD**: health, money, wanted stars, mission timer, speedometer,
  weapon and ammo, and a live 2D minimap with mission markers and police.
- **Day and night**: a full day/night cycle — golden-hour sunsets and a
  neon-drenched night with glowing signs, headlights, and fog.
- **Sound**: fully synthesized WebAudio — engine hum, sirens, gunshots, and
  mission jingles. M mutes.
- **Save**: progress, money, and best times persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| W / A / S / D | Drive / walk |
| Shift | Boost / sprint |
| Space | Handbrake |
| E | Enter / exit car, steal a car |
| F | Shoot (on foot) / fire from car |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| R | Reload |
| C | Change camera |
| M | Mute sound |
| P / Esc | Pause |
| Enter | Start mission / confirm |

## Screenshots

Four real renders of the game running in a browser: the cover (a golden-hour
chase through downtown), the city on foot, a mission in progress, and the neon
night.

## Tech

- Three.js r160, vendored under `game/vendor/` — no network requests, the game
  runs fully offline from its own files.
- `main.ts` hands the game in: it copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` with the kit's `buildDossier`.
- License: MIT.

Built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.
