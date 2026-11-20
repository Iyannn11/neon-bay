// Neon Bay sound: everything synthesised in WebAudio, no audio files.
// Engine hum, police siren, gunshots, pickup chimes and a small music loop.
// The context is created lazily on the first user gesture; until then every
// call is a safe no-op, so headless renders never throw.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // A short bassline + sparkle arpeggio, looped by a step timer.
  const bassNotes = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
  const arpNotes = [220, 277.18, 329.63, 440, 329.63, 277.18];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (err) {
      // A failed blip is never worth crashing the game over.
    }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq || 1800;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.3;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch (err) {
      // Ignore.
    }
  }

  return {
    // Call from the first user gesture (click / key) to unlock audio.
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value === true;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    // Called every frame with the player's speed (0..1) and whether driving.
    update(speedNorm, driving) {
      if (!ctx || muted) return;
      try {
        const target = driving ? 0.05 + speedNorm * 0.1 : 0.0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + speedNorm * 90, ctx.currentTime, 0.1);
      } catch (err) {
        // Ignore.
      }
    },
    siren(on) {
      if (!ctx || muted || !on) return;
      blip(660, 0.45, 'sine', 0.07, 880);
      setTimeout(() => blip(880, 0.45, 'sine', 0.07, 660), 480);
    },
    gunshot() {
      noiseBurst(0.12, 0.35, 2400);
    },
    punch() {
      noiseBurst(0.08, 0.2, 900);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.18);
      setTimeout(() => blip(1320, 0.18, 'sine', 0.18), 90);
    },
    cash() {
      blip(1046, 0.1, 'triangle', 0.2);
      setTimeout(() => blip(1318, 0.1, 'triangle', 0.2), 90);
      setTimeout(() => blip(1568, 0.22, 'triangle', 0.2), 180);
    },
    busted() {
      blip(220, 0.5, 'sawtooth', 0.15, 110);
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted || !ctx) return;
        const bass = bassNotes[musicStep % bassNotes.length];
        const arp = arpNotes[(musicStep * 2) % arpNotes.length];
        blip(bass, 0.32, 'triangle', 0.14);
        if (musicStep % 2 === 0) blip(arp, 0.16, 'sine', 0.06);
        musicStep++;
      }, 340);
    },
    stopMusic() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
