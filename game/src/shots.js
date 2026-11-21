// Neon Bay — screenshot staging.
//
// One clear job: when the page is opened with ?shot=cover|city|mission|night,
// put the game into the exact state that screenshot should show — the right
// place, the right vehicle, the right hour, the right mission, and a police
// car in frame — so the four screenshots are real renders of the game
// itself, never staged in an editor.

export function shotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seed = parseInt(q.get('seed') ?? '7', 10) || 7;
  return { shot, seed };
}

// The game object passed in is the live Game from main.js. Each branch sets
// the hour, the player's place and vehicle, the wanted level, and the
// mission state, then lets the normal game loop run so traffic, pedestrians
// and the police are alive in the frame. The near camera (mode 1) keeps the
// player big in the frame.
export function applyShot(game, shot) {
  const g = game;
  if (shot === 'cover') {
    // Golden-hour chase downtown: Kai in the Comet GT on the boulevard, an
    // interceptor head-on ahead, a second one chasing, mission 3's objective
    // on the HUD, the skyline glowing behind.
    g.hour = 17.6;
    g.cameraRig.mode = 1;
    g.setPlayerVehicle('comet', 96, 160, Math.PI);
    g.playerVehicle.speed = 14;
    g.police.setStars(2);
    g.police.spawnCar(96, 118, 0);
    g.missions.index = 2;
    g.missions.startMission(() => {});
    g.hud.center('', '');
  } else if (shot === 'city') {
    // On foot in the plaza at midday: pedestrians, traffic, shops and signs,
    // the green mission marker ahead.
    g.hour = 10.5;
    g.cameraRig.mode = 1;
    g.player.reset(32, 110);
    g.police.setStars(0);
    g.hud.center('', '');
  } else if (shot === 'mission') {
    // Mission 4 in progress at dusk: Kai on foot at the plaza, rivals in
    // the open, police closing in, wanted 2 stars, SMG ready.
    g.hour = 18.4;
    g.cameraRig.mode = 1;
    g.player.reset(32, 120);
    g.missions.index = 3;
    g.missions.startMission(() => {});
    g.missions.active.step = 1;
    g.missions._placeMarker();
    g.spawnRivals(32, 96, 4);
    g.police.setStars(2);
    g.combat.selectWeapon(1);
  } else if (shot === 'night') {
    // Neon night: Kai driving the coupe down the boulevard at 3 stars, an
    // interceptor head-on, the helicopter overhead, signs blazing.
    g.hour = 21.8;
    g.cameraRig.mode = 1;
    g.setPlayerVehicle('coupe', -32, 160, 0);
    g.playerVehicle.speed = 16;
    g.police.setStars(3);
    g.police.spawnCar(-32, 205, Math.PI);
    g.police.placeHelicopter(-32, 16, 215);
    g.missions.index = 4;
    g.missions.startMission(() => {});
  }
}
