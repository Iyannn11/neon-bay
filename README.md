# Neon Bay — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). You are **Kai Reyes**
in **Neon Bay**, a coastal city of neon towers, a beach, a marina and a highway
ring — on foot, by car and by motorcycle.

## Play it

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome. No network requests, no build step — Three.js is vendored under
`game/vendor/`.

```
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

## What's in the city

- **A living character, not a stiff doll** — walk and run cycles, idle
  breathing, jump tuck, two-handed aim with recoil, and a scripted car-entry
  animation (walk to the door, door swings open, sit down). Pointer-lock
  mouse-look, crosshair, right-click aim zoom, smooth acceleration and turning.
- **Vehicles** — sports car, sedans, a taxi, and two motorcycles (sport bike +
  cruiser) that lean into turns. Steal any of them with **E**; wrecks barely
  move until PAY N SPRAY fixes them for $100.
- **Six chained missions** — First Wheels, Taxi Driver, Neon Run (street
  race), Crate Hunter, Heat (lose a 3-star wanted level), and the $10,000
  finale **King of the Bay** at the marina.
- **Money that spends** — earn from missions, taxi fares, 10 neon crates,
  5 stunt jumps, 3 street races and 3 photo spots; spend it at AMMU-NATION
  (health / armor / ammo), at PAY N SPRAY, or on 4 outfits at THREADS.
- **People to talk to** — 8 named NPCs with their own lines; some hand you a
  tip or a mission hint. Pedestrians flee when shots ring out.
- **The law** — wanted level 0–5, chasing cop cars, roadblocks at 3 stars,
  and a helicopter with a sweeping searchlight at 4.
- **Weather and time** — full day/night cycle with a golden-hour sunset, rain
  you can toggle with **V** (wet shining roads, darker sky), and a Settings
  menu (volume, mouse sensitivity, graphics quality, weather, reset save).
- **HUD + minimap**, start / pause / game-over screens, localStorage saves,
  synthesized WebAudio sound (no audio files), and touch controls.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse (click to lock) | Look around |
| Left click | Shoot |
| Right click | Aim (zoom) |
| E | Enter car, talk, shop, change outfit |
| Space | Jump |
| Shift | Sprint |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| R | Reload |
| F | Take photo at a photo spot |
| T | Start a taxi job (in the taxi) |
| V | Toggle rain |
| P | Pause & settings |

## Files

- `main.ts` — entry program: copies `game/` + `screenshots/` to `/output`
  and writes `dossier.json` with the kit's `buildDossier`.
- `game/` — the playable game (`index.html` + `src/*.js`, Three.js vendored).
- `screenshots/` — 4 real renders of the game.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

MIT licensed. All city, characters, vehicles, names, story, art and sound are
original — nothing from Rockstar Games.
