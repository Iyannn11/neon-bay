[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Bay — Make GTA 6 bounty entry

An open-world crime game in the spirit of GTA 6, built from scratch in
Three.js. You are Kai Reyes, a driver-for-hire in Neon Bay, a coastal city
that never sleeps. Six jobs stand between you and the crown of the city.

## The story

Kai Reyes came to Neon Bay with a fast car and a faster reputation. A fixer
named Marlowe offers him a chain of jobs: a package at the docks, a stolen
Comet GT, a courier to tail through downtown, a three-star escape, the Coral
Bank vault — and the King of the Bay finale. Every job pays. Every job brings
heat. Finish the chain and Neon Bay is yours.

## The six missions

1. **First Light** ($500) — pick up a package at the docks, deliver it to the hideout.
2. **The Comet GT** ($1,200) — steal the sports car outside the casino, bring it to the garage in one piece.
3. **Tail the Courier** ($2,000) — follow the courier through downtown without being spotted.
4. **Heat Escape** ($3,500) — lose a three-star pursuit and reach the safehouse.
5. **The Coral Bank Job** ($6,000) — crack the vault (hold E for 8 seconds) and escape with the cash.
6. **King of the Bay** ($10,000) — the finale: escape four-star heat and stash the cash at the hideout.

## Systems

- **Driving** — WASD/arrows, Space handbrake, E to enter and steal cars. Acceleration, braking, steering, collisions.
- **Traffic** — 20 AI cars following the street grid in lanes, stopping for the car ahead; 35 pedestrians on the sidewalks who scatter and can be knocked down.
- **Wanted 0–5** — stealing, speeding, hitting pedestrians and shooting raise the heat. Police cars chase and ram; at 4+ stars a helicopter with a searchlight joins and roadblocks appear. Get busted on foot at 2+ stars and it is over.
- **Combat** — punch (F), pistol (mouse click, R reload). Police return fire at high wanted.
- **HUD** — health, cash, wanted stars, speed, clock, mission panel, a 2D minimap (player, traffic, police, mission marker) and an objective arrow.
- **Screens** — title, pause (Esc/P), game over (busted/wasted) with restart. Progress saves to localStorage (cash, missions done, best cash).
- **Sound** — fully synthesised WebAudio: engine hum, police siren, gunshots, pickup chimes and a music loop. M mutes.

## The city

A coastal city on a street grid: downtown towers (four distinct silhouettes — slab with setback and pyramid roof, smooth cylinder with spire, podium with slim tower, twin towers with a skybridge), lit windows, neon signs (CLUB, VICE, CASINO, NEON, HOTEL), a marina with yachts, a beach and boardwalk, a park, a lighthouse and a highway ring. Day and night lighting with soft shadows, glossy glass and additive glow on every neon sign and lamp. The visuals are smooth and cinematic — curved car bodies extruded from a side profile, cylinder figures, no blocky voxels.

## How to play

Serve the folder and open it in desktop Chrome:

```
node serve.ts
# open http://localhost:8080
```

No network request is made; everything loads from local files. The game is
deterministic per seed (`?seed=1337`); the four screenshots are staged with
`?shot=start|chase|mission|night&seed=1337`.

## File layout

- `game/index.html` — canvas, HUD, title/pause/game-over screens, import map.
- `game/src/main.js` — boot, game loop, camera, player, screens, shot hook.
- `game/src/config.js` — world constants, palette, tuning, the 6 missions.
- `game/src/random.js` — seeded mulberry32 RNG.
- `game/src/city.js` — towers, streets, marina, beach, park, lighthouse, day/night.
- `game/src/vehicles.js` — curved car bodies, player driving, traffic AI, stealing.
- `game/src/police.js` — wanted 0–5, pursuit, helicopter, roadblocks, busted.
- `game/src/pedestrians.js` — walking, scattering, knockdowns.
- `game/src/combat.js` — punch, pistol, reload, police return fire.
- `game/src/missions.js` — the six-job chain and its step triggers.
- `game/src/hud.js` — health, cash, stars, speed, clock, mission panel, minimap.
- `game/src/input.js` — keyboard, mouse-drag camera, touch controls.
- `game/src/audio.js` — synthesised WebAudio: engine, siren, shots, music.
- `game/src/shots.js` — deterministic `?shot=` staging for the screenshots.
- `game/src/save.js` — localStorage save/load/clear.
- `main.ts` — the hand-in program: copies game/ and screenshots/, writes dossier.json.
- `serve.ts` — local static server (port 8080).
- `shots.json` — the four screenshot definitions.
- `screenshots/` — the four real renders (cover first).

## License

MIT. See LICENSE.
