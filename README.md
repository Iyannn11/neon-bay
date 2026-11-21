# Neon Bay — Make GTA 6 (Round 11)

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Iyannn11/neon-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

**Neon Bay** is a sun-soaked coastal city. You are **Kai Reyes**, a driver
fresh out of the marina scene, working your way up from taxi fares and neon
crates to the **King of the Bay** finale. Explore on foot or by car, steal
sports cars and motorcycles, dodge (or outrun) the Neon Bay police, and build
your fortune.

## What is in the game

- **A living coastal city** — stepped towers, round glass spires, neon
  signs, a central plaza, a marina, a beach strip and a highway ring, all
  under a gradient sky with sun, clouds, stars and a golden hour.
- **On foot** — smooth third-person walk / run / jump with real character
  animation, pointer-lock mouse-look, aim zoom, and three weapons
  (pistol, SMG, shotgun) with pickups.
- **Vehicles** — sports cars, sedans, taxis and police cruisers, plus two
  motorcycles (Vortex R1 and Bay Cruiser) that lean into turns. Steal any
  of them with **E**.
- **Police** — a 0–5 wanted level, pursuing cruisers, roadblocks and a
  helicopter with a searchlight. Lay low and the heat fades.
- **Missions** — a 6-mission chain ending in the **King of the Bay**
  finale at the marina ($10,000).
- **Money and shops** — earn from fares, crates, photo spots, stunts and
  races; spend it at AMMU-NATION, PAY N SPRAY and the THREADS wardrobe
  (4 outfits).
- **People** — pedestrians and drivers you can talk to, with named
  dialogue, tips and hints.
- **Weather and settings** — rain or shine (V key), volume, mouse
  sensitivity, graphics quality, and a working save (localStorage).
- **Sound** — fully synthesized WebAudio: engine, gunshots, sirens,
  pickups and UI.

## How to play

Serve `game/` with any static server and open `game/index.html` in desktop
Chrome. No network is needed — every asset is a file under `game/`.

- **WASD** move · **Shift** sprint · **Space** jump · **Mouse** look
  (click to lock) · **LMB** shoot · **RMB** aim · **R** reload
- **E** enter / exit vehicle · **F** taxi job · **V** toggle weather
- **1 / 2 / 3** weapons · **Esc** pause / settings · **M** minimap zoom

Touch controls (joystick + action buttons) appear automatically on phones
and tablets.

## Structure

- `game/index.html` — page, import map, HUD shell
- `game/src/main.js` — boot, game loop, states, save, shot staging
- `game/src/world.js` — the city: buildings, streets, beach, marina, props
- `game/src/sky.js` — gradient sky dome, sun, moon, stars, clouds
- `game/src/textures.js` — procedural canvas textures (ground, glow, signs)
- `game/src/player.js` — Kai: movement, animation, weapons
- `game/src/vehicles.js` — cars, motorcycles, traffic AI
- `game/src/pedestrians.js` — NPCs and dialogue
- `game/src/police.js` — wanted level, pursuit, helicopter, roadblocks
- `game/src/missions.js` — the 6-mission chain
- `game/src/weather.js` — rain and sunshine
- `game/src/hud.js` — HUD, minimap, menus, shops, dialogs
- `game/src/audio.js` — synthesized sound effects
- `game/src/input.js` — keyboard, mouse, pointer lock, touch
- `game/src/config.js` — tuning constants · `game/src/random.js` — seeded RNG
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes
  `dossier.json`)

Built from scratch for the make.fun gta6-01 competition. All art, names,
characters and story are original.
